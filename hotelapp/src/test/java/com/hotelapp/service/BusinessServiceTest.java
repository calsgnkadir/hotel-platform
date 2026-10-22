package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.User;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.repository.BusinessPhotoRepository;
import com.hotelapp.repository.BusinessRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/** İşletme sahibinin hesap e-postası herkese açık yanıtlarda görünmez (KVKK). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BusinessServiceTest {

    @Mock private BusinessRepository businessRepository;
    @Mock private BusinessPhotoRepository businessPhotoRepository;
    @Mock private FileStorageService fileStorageService;
    @InjectMocks private BusinessService service;

    private Business business(long id, User owner) {
        return Business.builder().id(id).name("Otel " + id).type(BusinessType.HOTEL).owner(owner).build();
    }

    private User owner(long id) {
        return User.builder().id(id).email("sahip" + id + "@test.com").fullName("Sahip").enabled(true).build();
    }

    @Test
    @DisplayName("Herkese açık tekil işletme yanıtında sahibin e-postası yok")
    void publicById_hidesOwnerEmail() {
        when(businessRepository.findById(1L)).thenReturn(Optional.of(business(1L, owner(10L))));
        when(businessPhotoRepository.findByBusinessIdAndIsCoverTrue(1L)).thenReturn(Optional.empty());

        assertThat(service.getPublicById(1L).getEmail()).isNull();
    }

    @Test
    @DisplayName("Sahibin kendi profil yanıtında e-posta görünür")
    void myProfile_keepsOwnerEmail() {
        when(businessRepository.findByOwnerId(10L)).thenReturn(Optional.of(business(1L, owner(10L))));
        when(businessPhotoRepository.findByBusinessIdAndIsCoverTrue(1L)).thenReturn(Optional.empty());

        assertThat(service.getMyProfile(10L).getEmail()).isEqualTo("sahip10@test.com");
    }

    @Test
    @DisplayName("Liste: e-posta yok; kapatılmış (enabled=false) ve yasaklı sahiplerin işletmeleri dışlanır")
    void list_hidesEmail_andExcludesInactiveOwners() {
        User active = owner(10L);
        User disabled = owner(11L);
        disabled.setEnabled(false);
        User banned = owner(12L);
        banned.setBannedUntil(LocalDateTime.now().plusDays(5));
        User banOver = owner(13L);
        banOver.setBannedUntil(LocalDateTime.now().minusDays(1));
        when(businessRepository.findAll()).thenReturn(List.of(
                business(1L, active), business(2L, disabled), business(3L, banned), business(4L, banOver)));
        when(businessPhotoRepository.findByBusinessIdAndIsCoverTrue(org.mockito.ArgumentMatchers.anyLong()))
                .thenReturn(Optional.empty());

        var list = service.getAllBusinesses(null);

        assertThat(list).extracting(BusinessService.BusinessDto::getId).containsExactly(1L, 4L);
        assertThat(list).allMatch(d -> d.getEmail() == null);
    }

    @Test
    @DisplayName("Tekil sayfa: yasaklı ya da kapatılmış sahibin işletmesi 404")
    void publicById_inactiveOwner_notFound() {
        User banned = owner(12L);
        banned.setBannedUntil(LocalDateTime.now().plusDays(5));
        User disabled = owner(11L);
        disabled.setEnabled(false);
        when(businessRepository.findById(2L)).thenReturn(Optional.of(business(2L, banned)));
        when(businessRepository.findById(3L)).thenReturn(Optional.of(business(3L, disabled)));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.getPublicById(2L))
                .isInstanceOf(com.hotelapp.exception.ResourceNotFoundException.class);
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.getPublicById(3L))
                .isInstanceOf(com.hotelapp.exception.ResourceNotFoundException.class);
    }
}
