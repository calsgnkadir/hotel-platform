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
        when(applicationRepository.findAllByCandidateId(7L)).thenReturn(List.of());
        Page<com.hotelapp.entity.Notification> emptyPage = new PageImpl<>(List.of());
        when(notificationRepository.findAllByRecipientIdOrderByCreatedAtDesc(eq7L(), any(Pageable.class)))
                .thenReturn(emptyPage);

        var data = service.exportUserData(7L);

        assertThat(data).containsKeys("profile", "applications", "notifications", "exportedAt", "legalBasis");
        @SuppressWarnings("unchecked")
        var profile = (java.util.Map<String, Object>) data.get("profile");
        assertThat(profile.get("email")).isEqualTo("u7@x.com");
        assertThat(profile.get("fullName")).isEqualTo("Ad Soyad");
    }

    private static long eq7L() { return org.mockito.ArgumentMatchers.eq(7L); }

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
}
