package com.hotelapp.service;

import com.hotelapp.dto.ApplicationResponse;
import com.hotelapp.entity.*;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.ShiftSlotRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * FAZ C.1 — Yedek (standby) aday sistemi birim testleri.
 * Odak: "gelmezse yerine adam" zinciri — yedege alma, no-show sonrasi
 * otomatik teklif, kabul edince slotun yeniden dolmasi.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StandbyServiceTest {

    @Mock private ApplicationRepository applicationRepository;
    @Mock private ShiftSlotRepository shiftSlotRepository;
    @Mock private NotificationService notificationService;
    @Mock private OutboxService outboxService;
    @Mock private ApplicationMapper applicationMapper;

    private StandbyService service;

    private static final Long OWNER_ID = 11L;
    private static final Long CANDIDATE_ID = 7L;
    private static final Long LISTING_ID = 3L;
    private static final Long APP_ID = 42L;

    StandbyServiceTest() { }

    private StandbyService svc() {
        if (service == null) {
            service = new StandbyService(applicationRepository, shiftSlotRepository,
                    notificationService, outboxService, applicationMapper);
            lenient().when(applicationMapper.toResponse(any()))
                    .thenReturn(ApplicationResponse.builder().build());
        }
        return service;
    }

    // ================================================================
    // Fixtures
    // ================================================================

    private User user(Long id) {
        User u = new User();
        u.setId(id);
        u.setEmail("user" + id + "@test.com");
        u.setFullName("Kullanici " + id);
        return u;
    }

    private JobListing listing() {
        User owner = user(OWNER_ID);
        Business b = new Business();
        b.setId(2L);
        b.setName("Test Otel");
        b.setOwner(owner);

        JobListing l = new JobListing();
        l.setId(LISTING_ID);
        l.setTitle("Garson");
        l.setBusiness(b);
        return l;
    }

    /** Yarin icin, henuz gecmemis bir vardiya slotu. */
    private ShiftSlot upcomingSlot(int slotsNeeded, int slotsFilled) {
        return ShiftSlot.builder()
                .id(500L)
                .date(LocalDate.now().plusDays(1))
                .startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(16, 0))
                .slotsNeeded(slotsNeeded)
                .slotsFilled(slotsFilled)
                .build();
    }

    private Application app(Long id, ApplicationStatus status, ShiftSlot... slots) {
        return Application.builder()
                .id(id)
                .status(status)
                .candidate(user(CANDIDATE_ID))
                .jobListing(listing())
                .requestedSlots(slots.length == 0 ? Set.of() : Set.of(slots))
                .build();
    }

    // ================================================================
    @Nested
    @DisplayName("markAsStandby")
    class MarkAsStandby {

        @Test
        @DisplayName("PENDING başvuru STANDBY olur, sıra atanır, adaya bildirim gider")
        void pending_becomesStandby() {
            Application a = app(APP_ID, ApplicationStatus.PENDING);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));
            when(applicationRepository.countByJobListingIdAndStatus(LISTING_ID, ApplicationStatus.STANDBY))
                    .thenReturn(0L);

            svc().markAsStandby(APP_ID, OWNER_ID);

            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.STANDBY);
            assertThat(a.getStandbyRank()).isEqualTo(1);
            assertThat(a.getStandbyOfferedAt()).isNull();
            verify(notificationService).notify(eq(CANDIDATE_ID),
                    eq(NotificationType.STANDBY_ASSIGNED), any(), any(), any());
        }

        @Test
        @DisplayName("İkinci yedek 2. sırayı alır")
        void secondStandby_getsRankTwo() {
            Application a = app(APP_ID, ApplicationStatus.REVIEWING);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));
            when(applicationRepository.countByJobListingIdAndStatus(LISTING_ID, ApplicationStatus.STANDBY))
                    .thenReturn(1L);

            svc().markAsStandby(APP_ID, OWNER_ID);

            assertThat(a.getStandbyRank()).isEqualTo(2);
        }

        @Test
        @DisplayName("Sonuçlanmış (ACCEPTED) başvuru yedeğe alınamaz")
        void accepted_rejected() {
            Application a = app(APP_ID, ApplicationStatus.ACCEPTED);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));

            assertThatThrownBy(() -> svc().markAsStandby(APP_ID, OWNER_ID))
                    .isInstanceOf(BusinessRuleException.class);
            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
        }

        @Test
        @DisplayName("Başka işletmenin başvurusu: UnauthorizedException")
        void differentOwner_throws() {
            Application a = app(APP_ID, ApplicationStatus.PENDING);
            a.getJobListing().getBusiness().getOwner().setId(99L);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));

            assertThatThrownBy(() -> svc().markAsStandby(APP_ID, OWNER_ID))
                    .isInstanceOf(UnauthorizedException.class);
        }
    }

    // ================================================================
    @Nested
    @DisplayName("offerAfterNoShow")
    class OfferAfterNoShow {

        @Test
        @DisplayName("Sıradaki yedeğe teklif gider: deadline set + STANDBY_ACTIVATED bildirimi")
        void offersToNextStandby() {
            Application noShow = app(APP_ID, ApplicationStatus.ACCEPTED, upcomingSlot(1, 0));
            Application standby = app(77L, ApplicationStatus.STANDBY, upcomingSlot(1, 0));
            standby.setStandbyRank(1);

            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(noShow));
            when(applicationRepository.findAvailableStandbys(LISTING_ID)).thenReturn(List.of(standby));

            Long offered = svc().offerAfterNoShow(APP_ID);

            assertThat(offered).isEqualTo(77L);
            assertThat(standby.getStandbyOfferedAt()).isNotNull();
            assertThat(standby.getStandbyDeadline()).isAfter(LocalDateTime.now());
            assertThat(standby.getStandbyReplacesApplicationId()).isEqualTo(APP_ID);
            verify(notificationService).notify(eq(CANDIDATE_ID),
                    eq(NotificationType.STANDBY_ACTIVATED), any(), any(), any());
        }

        @Test
        @DisplayName("Yedek yoksa null döner ve işletme bilgilendirilir")
        void noStandby_notifiesOwner() {
            Application noShow = app(APP_ID, ApplicationStatus.ACCEPTED, upcomingSlot(1, 0));
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(noShow));
            when(applicationRepository.findAvailableStandbys(LISTING_ID)).thenReturn(List.of());

            assertThat(svc().offerAfterNoShow(APP_ID)).isNull();

            verify(notificationService).notify(eq(OWNER_ID),
                    eq(NotificationType.STANDBY_DECLINED), any(), any(), any());
        }

        @Test
        @DisplayName("Vardiya geçmişse teklif gönderilmez")
        void pastShift_skipped() {
            ShiftSlot past = ShiftSlot.builder()
                    .id(501L)
                    .date(LocalDate.now().minusDays(2))
                    .startTime(LocalTime.of(8, 0))
                    .endTime(LocalTime.of(16, 0))
                    .slotsNeeded(1).slotsFilled(0)
                    .build();
            Application noShow = app(APP_ID, ApplicationStatus.ACCEPTED, past);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(noShow));

            assertThat(svc().offerAfterNoShow(APP_ID)).isNull();

            verify(applicationRepository, never()).findAvailableStandbys(any());
        }
    }

    // ================================================================
    @Nested
    @DisplayName("respondToOffer")
    class RespondToOffer {

        private Application offeredStandby(ShiftSlot slot) {
            Application a = app(77L, ApplicationStatus.STANDBY, slot);
            a.setStandbyRank(1);
            a.setStandbyOfferedAt(LocalDateTime.now().minusMinutes(10));
            a.setStandbyDeadline(LocalDateTime.now().plusHours(2));
            a.setStandbyReplacesApplicationId(APP_ID);
            return a;
        }

        @Test
        @DisplayName("Kabul: ACCEPTED olur ve slot yeniden dolar")
        void accept_fillsSlot() {
            ShiftSlot slot = upcomingSlot(1, 0);
            Application a = offeredStandby(slot);
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));

            svc().respondToOffer(77L, CANDIDATE_ID, true);

            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
            assertThat(slot.getSlotsFilled()).isEqualTo(1);
            verify(shiftSlotRepository).save(slot);
            verify(notificationService).notify(eq(OWNER_ID),
                    eq(NotificationType.STANDBY_FILLED), any(), any(), any());
        }

        @Test
        @DisplayName("Slot bu arada dolduysa kabul reddedilir")
        void accept_slotFull_throws() {
            ShiftSlot full = upcomingSlot(1, 1);
            Application a = offeredStandby(full);
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));

            assertThatThrownBy(() -> svc().respondToOffer(77L, CANDIDATE_ID, true))
                    .isInstanceOf(BusinessRuleException.class);
            assertThat(full.getSlotsFilled()).isEqualTo(1);
        }

        @Test
        @DisplayName("Ret: WITHDRAWN olur, işletme bilgilendirilir, sıradaki yedeğe geçilir")
        void decline_cascades() {
            Application a = offeredStandby(upcomingSlot(1, 0));
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));
            // cascade -> offerAfterNoShow(APP_ID)
            Application noShow = app(APP_ID, ApplicationStatus.ACCEPTED, upcomingSlot(1, 0));
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(noShow));
            when(applicationRepository.findAvailableStandbys(LISTING_ID)).thenReturn(List.of());

            svc().respondToOffer(77L, CANDIDATE_ID, false);

            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.WITHDRAWN);
            // İşletme bilgilendirilir. Bu senaryoda 2 kez gelir: (1) aday reddetti,
            // (2) cascade sonrası başka yedek kalmadı. NotificationService aynı tipi
            // 5dk içinde zaten tek kayıtta topluyor.
            verify(notificationService, atLeastOnce()).notify(eq(OWNER_ID),
                    eq(NotificationType.STANDBY_DECLINED), any(), any(), any());
            // sıradaki yedek arandı
            verify(applicationRepository).findAvailableStandbys(LISTING_ID);
        }

        @Test
        @DisplayName("Aktif teklifi olmayan başvuruya cevap verilemez")
        void noActiveOffer_throws() {
            Application a = app(77L, ApplicationStatus.STANDBY, upcomingSlot(1, 0));
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));

            assertThatThrownBy(() -> svc().respondToOffer(77L, CANDIDATE_ID, true))
                    .isInstanceOf(BusinessRuleException.class);
        }

        @Test
        @DisplayName("Süresi geçmiş teklif: hata + başvuru EXPIRED'a düşer")
        void expiredOffer_throwsAndExpires() {
            Application a = offeredStandby(upcomingSlot(1, 0));
            a.setStandbyDeadline(LocalDateTime.now().minusMinutes(1));
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));

            assertThatThrownBy(() -> svc().respondToOffer(77L, CANDIDATE_ID, true))
                    .isInstanceOf(BusinessRuleException.class);
            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
        }

        @Test
        @DisplayName("Başkasının başvurusuna cevap verilemez")
        void otherCandidate_throws() {
            Application a = offeredStandby(upcomingSlot(1, 0));
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));

            assertThatThrownBy(() -> svc().respondToOffer(77L, 999L, true))
                    .isInstanceOf(UnauthorizedException.class);
        }
    }

    // ================================================================
    @Nested
    @DisplayName("expireOverdueOffers")
    class ExpireOverdue {

        @Test
        @DisplayName("Süresi geçen teklif EXPIRED olur ve iki tarafa bildirim gider")
        void expiresAndNotifiesBoth() {
            Application a = app(77L, ApplicationStatus.STANDBY, upcomingSlot(1, 0));
            a.setStandbyOfferedAt(LocalDateTime.now().minusHours(4));
            a.setStandbyDeadline(LocalDateTime.now().minusHours(1));
            a.setStandbyReplacesApplicationId(null);   // cascade yok

            when(applicationRepository.findByStatusAndStandbyDeadlineBefore(
                    eq(ApplicationStatus.STANDBY), any())).thenReturn(List.of(a));

            int n = svc().expireOverdueOffers();

            assertThat(n).isEqualTo(1);
            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
            verify(notificationService).notify(eq(CANDIDATE_ID),
                    eq(NotificationType.STANDBY_OFFER_EXPIRED), any(), any(), any());
            verify(notificationService).notify(eq(OWNER_ID),
                    eq(NotificationType.STANDBY_DECLINED), any(), any(), any());
        }

        @Test
        @DisplayName("Süresi geçen teklif yoksa 0 döner")
        void noneOverdue_returnsZero() {
            when(applicationRepository.findByStatusAndStandbyDeadlineBefore(
                    eq(ApplicationStatus.STANDBY), any())).thenReturn(List.of());

            assertThat(svc().expireOverdueOffers()).isZero();
            verifyNoInteractions(notificationService);
        }
    }
}
