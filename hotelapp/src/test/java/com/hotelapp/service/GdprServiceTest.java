package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.NotificationRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GdprServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private NotificationRepository notificationRepository;
    @Mock private OutboxService outboxService;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private AccountClosureService accountClosureService;
    @Mock private FileStorageService fileStorageService;
    @Mock private com.hotelapp.repository.BusinessRepository businessRepository;
    @Mock private com.hotelapp.repository.BusinessPhotoRepository businessPhotoRepository;
    @Mock private com.hotelapp.repository.UserAvailabilityBlockRepository availabilityBlockRepository;
    @Mock private com.hotelapp.repository.SavedSearchRepository savedSearchRepository;
    @Mock private com.hotelapp.repository.PushSubscriptionRepository pushSubscriptionRepository;
    @InjectMocks private GdprService service;

    private User user(long id) {
        User u = new User();
        u.setId(id);
        u.setEmail("u" + id + "@x.com");
        u.setFullName("Ad Soyad");
        u.setRole(Role.CANDIDATE);
        u.setEnabled(true);
        return u;
    }

    @Test
    @DisplayName("requestDeletion: enabled=false + deletionRequestedAt + 30 gun cutoff")
    void requestDeletion_setsFields() {
        User u = user(42L);
        when(userRepository.findById(42L)).thenReturn(Optional.of(u));

        service.requestDeletion(42L);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User saved = captor.getValue();
        assertThat(saved.isEnabled()).isFalse();
        assertThat(saved.getDeletionRequestedAt()).isNotNull();
        assertThat(saved.getScheduledAnonymizeAt())
                .isAfter(LocalDateTime.now().plusDays(GdprService.DELETION_GRACE_DAYS - 1))
                .isBefore(LocalDateTime.now().plusDays(GdprService.DELETION_GRACE_DAYS + 1));
        // Outbox audit log
        verify(outboxService).appendAuditLog(any());
        // Silme talebiyle tum oturumlar kapanir
        verify(refreshTokenService).revokeAllForUser(42L);
    }

    @Test
    @DisplayName("requestDeletion idempotent: 2. call save edilmez")
    void requestDeletion_idempotent() {
        User u = user(42L);
        u.setDeletionRequestedAt(LocalDateTime.now().minusDays(1));
        when(userRepository.findById(42L)).thenReturn(Optional.of(u));

        service.requestDeletion(42L);

        verify(userRepository, never()).save(any());
        verify(outboxService, never()).appendAuditLog(any());
        verify(refreshTokenService, never()).revokeAllForUser(any());
    }

    @Test
    @DisplayName("requestDeletion: user yoksa ResourceNotFoundException")
    void requestDeletion_userNotFound() {
        when(userRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.requestDeletion(999L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("exportUserData: profile + applications + notifications doluyor")
    void exportUserData_includesAllSections() {
        User u = user(7L);
        when(userRepository.findById(7L)).thenReturn(Optional.of(u));
        when(applicationRepository.findAllByCandidateIdForExport(7L)).thenReturn(List.of());
        Page<com.hotelapp.entity.Notification> emptyPage = new PageImpl<>(List.of());
        when(notificationRepository.findAllByRecipientIdOrderByCreatedAtDesc(
                org.mockito.ArgumentMatchers.eq(7L), any(Pageable.class)))
                .thenReturn(emptyPage);

        var data = service.exportUserData(7L);

        assertThat(data).containsKeys("profile", "applications", "notifications", "exportedAt", "legalBasis");
        @SuppressWarnings("unchecked")
        var profile = (java.util.Map<String, Object>) data.get("profile");
        assertThat(profile.get("email")).isEqualTo("u7@x.com");
        assertThat(profile.get("fullName")).isEqualTo("Ad Soyad");
    }

    @Test
    @DisplayName("anonymizeDueAccounts: email maskelenir, name silinmis kullanici olur")
    void anonymizeDueAccounts_masksFields() {
        User u = user(99L);
        u.setEnabled(false);
        u.setDeletionRequestedAt(LocalDateTime.now().minusDays(31));
        u.setScheduledAnonymizeAt(LocalDateTime.now().minusDays(1));
        u.setPhone("+905551234567");
        u.setDistrict("Beyoğlu");
        when(userRepository.findAllByScheduledAnonymizeAtBefore(any())).thenReturn(List.of(u));
        when(userRepository.findById(u.getId())).thenReturn(Optional.of(u));

        service.anonymizeDueAccounts();

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User anonymized = captor.getValue();
        assertThat(anonymized.getEmail()).isEqualTo("deleted-99@deleted.local");
        assertThat(anonymized.getFullName()).isEqualTo("Silinmiş Kullanıcı");
        assertThat(anonymized.getPhone()).isNull();
        assertThat(anonymized.getDistrict()).isNull();
        assertThat(anonymized.getScheduledAnonymizeAt()).isNull();
        verify(outboxService).appendAuditLog(any());
    }

    // ================================================================
    // Silme talebi aninda acik taahhutler
    // ================================================================

    @Test
    @DisplayName("requestDeletion (isletme): ilanlar ortak kapanis yolundan kapanir")
    void requestDeletion_businessOwner_closesListings() {
        User u = user(50L);
        u.setRole(Role.BUSINESS_OWNER);
        when(userRepository.findById(50L)).thenReturn(Optional.of(u));

        service.requestDeletion(50L);

        verify(accountClosureService).closeBusinessListings(50L);
        verify(accountClosureService, never()).releaseCandidate(any(), any(), any());
    }

    @Test
    @DisplayName("requestDeletion (aday): taahhutler sinirsiz (tum gelecek vardiyalar) birakilir, havuzdan cikar")
    void requestDeletion_candidate_releasesCommitments() {
        User u = user(42L);
        u.setAvailableUntil(LocalDateTime.now().plusHours(3));
        when(userRepository.findById(42L)).thenReturn(Optional.of(u));

        service.requestDeletion(42L);

        verify(accountClosureService).releaseCandidate(42L, null, AccountClosureService.Reason.ACCOUNT_CLOSED);
        verify(accountClosureService, never()).closeBusinessListings(any());
        assertThat(u.getAvailableUntil()).isNull();
    }

    @Test
    @DisplayName("requestDeletion idempotent: ikinci cagri taahhutlere dokunmaz")
    void requestDeletion_idempotent_noClosure() {
        User u = user(42L);
        u.setDeletionRequestedAt(LocalDateTime.now().minusDays(1));
        when(userRepository.findById(42L)).thenReturn(Optional.of(u));

        service.requestDeletion(42L);

        org.mockito.Mockito.verifyNoInteractions(accountClosureService);
    }

    // ================================================================
    // Anonimlestirme kapsami
    // ================================================================

    private User fullCandidate(long id) {
        User u = user(id);
        u.setEnabled(false);
        u.setScheduledAnonymizeAt(LocalDateTime.now().minusDays(1));
        u.setPassword("$2a$hash");
        u.setProvider(com.hotelapp.enums.AuthProvider.GOOGLE);
        u.setProviderId("google-sub-123");
        u.setPhone("+905551234567");
        u.setPhoneVerifiedAt(LocalDateTime.now());
        u.setPhoneOtpCode("123456");
        u.setPhoneOtpExpiresAt(LocalDateTime.now());
        u.setPhoneOtpSentAt(LocalDateTime.now());
        u.setPhoneOtpAttempts(2);
        u.setAvatarPath("upload:image:kadrom/avatars/1/a.jpg");
        u.setDistrict("Beyoğlu");
        u.setNeighborhood("Cihangir");
        u.setBirthDate(java.time.LocalDate.of(2000, 1, 1));
        u.setGender(com.hotelapp.enums.Gender.values()[0]);
        u.setEducation(com.hotelapp.enums.EducationLevel.values()[0]);
        u.setPreviousExperience("Iki yil garsonluk");
        u.setSmokes(true);
        u.setHasLicense(true);
        u.setAvailableUntil(LocalDateTime.now().plusHours(2));
        u.setLanguages(new java.util.HashSet<>(java.util.Set.of(com.hotelapp.enums.Language.values()[0])));
        u.setAvailabilityTypes(new java.util.HashSet<>(java.util.Set.of(com.hotelapp.enums.JobType.values()[0])));
        u.setPreferredDistricts(new java.util.HashSet<>(java.util.Set.of("Kadıköy")));
        u.setPreferredPositions(new java.util.HashSet<>(java.util.Set.of(com.hotelapp.enums.Position.WAITER)));
        return u;
    }

    @Test
    @DisplayName("anonymize: listedeki tum kisisel alanlar, on yazilar/notlar temizlenir; avatar depodan silinir")
    void anonymize_clearsAllPersonalFields_andDeletesAvatar() {
        User u = fullCandidate(99L);
        com.hotelapp.entity.Application a = com.hotelapp.entity.Application.builder()
                .id(1L).coverLetter("Merhaba, deneyimliyim").note("Guler yuzlu").build();
        when(userRepository.findAllByScheduledAnonymizeAtBefore(any())).thenReturn(List.of(u));
        when(userRepository.findById(u.getId())).thenReturn(Optional.of(u));
        when(applicationRepository.findAllByCandidateId(99L)).thenReturn(List.of(a));

        service.anonymizeDueAccounts();

        assertThat(u.getEmail()).isEqualTo("deleted-99@deleted.local");
        assertThat(u.getFullName()).isEqualTo("Silinmiş Kullanıcı");
        // NOT NULL kolon: null degil, eski parolayla da hicbir parolayla da eslesmeyen BCrypt ozeti
        assertThat(u.getPassword()).isNotBlank().isNotEqualTo("$2a$hash").startsWith("$2a$");
        assertThat(u.getProviderId()).isNull();
        assertThat(u.getPhone()).isNull();
        assertThat(u.getPhoneVerifiedAt()).isNull();
        assertThat(u.getPhoneOtpCode()).isNull();
        assertThat(u.getPhoneOtpExpiresAt()).isNull();
        assertThat(u.getPhoneOtpSentAt()).isNull();
        assertThat(u.getPhoneOtpAttempts()).isZero();
        assertThat(u.getAvatarPath()).isNull();
        assertThat(u.getDistrict()).isNull();
        assertThat(u.getNeighborhood()).isNull();
        assertThat(u.getBirthDate()).isNull();
        assertThat(u.getGender()).isNull();
        assertThat(u.getEducation()).isNull();
        assertThat(u.getPreviousExperience()).isNull();
        assertThat(u.getSmokes()).isNull();
        assertThat(u.getHasLicense()).isNull();
        assertThat(u.getAvailableUntil()).isNull();
        assertThat(u.getLanguages()).isEmpty();
        assertThat(u.getAvailabilityTypes()).isEmpty();
        assertThat(u.getPreferredDistricts()).isEmpty();
        assertThat(u.getPreferredPositions()).isEmpty();
        assertThat(a.getCoverLetter()).isNull();
        assertThat(a.getNote()).isNull();
        verify(availabilityBlockRepository).deleteAllByUserId(99L);
        verify(fileStorageService).delete("upload:image:kadrom/avatars/1/a.jpg");
    }

    @Test
    @DisplayName("anonymizeDueAccounts: bir kullanicinin hatasi digerlerini durdurmaz; kurtarilan hesaba dokunulmaz")
    void anonymizeDueAccounts_isolatesFailuresPerUser() {
        User bad = user(1L);
        bad.setScheduledAnonymizeAt(LocalDateTime.now().minusDays(1));
        User good = user(2L);
        good.setScheduledAnonymizeAt(LocalDateTime.now().minusDays(1));
        User recovered = user(3L);   // listede ama bu arada kurtarildi
        when(userRepository.findAllByScheduledAnonymizeAtBefore(any())).thenReturn(List.of(bad, good, recovered));
        when(userRepository.findById(1L)).thenReturn(Optional.of(bad));
        when(userRepository.findById(2L)).thenReturn(Optional.of(good));
        when(userRepository.findById(3L)).thenReturn(Optional.of(user(3L)));
        when(applicationRepository.findAllByCandidateId(1L)).thenThrow(new RuntimeException("db"));

        service.anonymizeDueAccounts();

        assertThat(good.getEmail()).isEqualTo("deleted-2@deleted.local");
        verify(applicationRepository, never()).findAllByCandidateId(3L);
    }

    @Test
    @DisplayName("anonymize: avatar silme hatasi anonimlestirmeyi durdurmaz (kayit + audit yine olur)")
    void anonymize_avatarDeleteFailure_doesNotStop() {
        User u = fullCandidate(99L);
        when(userRepository.findAllByScheduledAnonymizeAtBefore(any())).thenReturn(List.of(u));
        when(userRepository.findById(u.getId())).thenReturn(Optional.of(u));
        org.mockito.Mockito.doThrow(new RuntimeException("cloudinary down"))
                .when(fileStorageService).delete(any());

        service.anonymizeDueAccounts();

        verify(userRepository).save(u);
        assertThat(u.getAvatarPath()).isNull();
        verify(outboxService).appendAuditLog(any());
    }

    @Test
    @DisplayName("anonymize (isletme): isletme adi/iletisim maskelenir, logo+fotograflar silinir, kayit kalir")
    void anonymize_businessOwner_masksBusiness() {
        User u = user(60L);
        u.setRole(Role.BUSINESS_OWNER);
        u.setScheduledAnonymizeAt(LocalDateTime.now().minusDays(1));
        com.hotelapp.entity.Business b = com.hotelapp.entity.Business.builder()
                .id(3L).name("Deniz Otel").address("Sokak 1").phone("02120000000")
                .website("https://example.test").instagram("deniz").facebook("deniz")
                .description("Aciklama").workingHours("09-18").logoPath("upload:image:logo")
                .district("Beşiktaş").owner(u).build();
        com.hotelapp.entity.BusinessPhoto photo = new com.hotelapp.entity.BusinessPhoto();
        photo.setFilePath("upload:image:photo1");
        when(userRepository.findAllByScheduledAnonymizeAtBefore(any())).thenReturn(List.of(u));
        when(userRepository.findById(u.getId())).thenReturn(Optional.of(u));
        when(businessRepository.findByOwnerId(60L)).thenReturn(Optional.of(b));
        when(businessPhotoRepository.findAllByBusinessIdOrderByCreatedAtDesc(3L)).thenReturn(List.of(photo));

        service.anonymizeDueAccounts();

        assertThat(b.getName()).isEqualTo("Kapatılmış işletme");
        assertThat(b.getAddress()).isNull();
        assertThat(b.getPhone()).isNull();
        assertThat(b.getWebsite()).isNull();
        assertThat(b.getInstagram()).isNull();
        assertThat(b.getFacebook()).isNull();
        assertThat(b.getDescription()).isNull();
        assertThat(b.getWorkingHours()).isNull();
        assertThat(b.getLogoPath()).isNull();
        assertThat(b.getDistrict()).isEqualTo("Beşiktaş");
        verify(businessRepository).save(b);
        verify(businessPhotoRepository).deleteAll(List.of(photo));
        verify(fileStorageService).delete("upload:image:logo");
        verify(fileStorageService).delete("upload:image:photo1");
    }
}
