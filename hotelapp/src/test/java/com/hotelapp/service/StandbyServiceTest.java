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
    @Mock private SmsService smsService;
    @Mock private com.hotelapp.repository.CandidateBlockRepository candidateBlockRepository;
    @Mock private com.hotelapp.repository.UserRepository userRepository;
    @Mock private com.hotelapp.repository.JobListingRepository jobListingRepository;

    private StandbyService service;

    private static final Long OWNER_ID = 11L;
    private static final Long CANDIDATE_ID = 7L;
    private static final Long LISTING_ID = 3L;
    private static final Long APP_ID = 42L;

    StandbyServiceTest() { }

    private StandbyService svc() {
        if (service == null) {
            service = new StandbyService(applicationRepository, shiftSlotRepository,
                    notificationService, outboxService, applicationMapper, smsService,
                    candidateBlockRepository, userRepository, jobListingRepository);
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
            when(applicationRepository.findMaxStandbyRank(LISTING_ID)).thenReturn(null);

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
            when(applicationRepository.findMaxStandbyRank(LISTING_ID)).thenReturn(1);

            svc().markAsStandby(APP_ID, OWNER_ID);

            assertThat(a.getStandbyRank()).isEqualTo(2);
        }

        @Test
        @DisplayName("Sıra ilan kilidi altında MAX + 1: çıkarılan yedekten sonra sıra tekrarlanmaz")
        void rank_isMaxPlusOne_underListingLock() {
            Application a = app(APP_ID, ApplicationStatus.PENDING);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));
            // 1, 2, 3 sıralı yedeklerden 1 çıkarıldı: sayı 2 ama en büyük sıra 3
            when(applicationRepository.findMaxStandbyRank(LISTING_ID)).thenReturn(3);

            svc().markAsStandby(APP_ID, OWNER_ID);

            assertThat(a.getStandbyRank()).isEqualTo(4);
            org.mockito.InOrder order = inOrder(jobListingRepository, applicationRepository);
            order.verify(jobListingRepository).lockById(LISTING_ID);
            order.verify(applicationRepository).findMaxStandbyRank(LISTING_ID);
            order.verify(applicationRepository).save(a);
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
            // Bosalan koltuk: ilanin acik ve bitmemis slotu (zincir devami / ilk teklif ayni kural)
            when(shiftSlotRepository.findAllByJobListingId(LISTING_ID)).thenReturn(List.of(upcomingSlot(1, 0)));

            Long offered = svc().offerAfterNoShow(APP_ID);

            assertThat(offered).isEqualTo(77L);
            assertThat(standby.getStandbyOfferedAt()).isNotNull();
            assertThat(standby.getStandbyDeadline()).isAfter(LocalDateTime.now());
            assertThat(standby.getStandbyReplacesApplicationId()).isEqualTo(APP_ID);
            verify(notificationService).notify(eq(CANDIDATE_ID),
                    eq(NotificationType.STANDBY_ACTIVATED), any(), any(), any());
        }

        @Test
        @DisplayName("Zincir kilidi: ilan kilitlenir; aynı boşluk için aktif teklif varsa ikinci teklif gitmez")
        void activeOfferForSameVacancy_skips() {
            Application noShow = app(APP_ID, ApplicationStatus.ACCEPTED, upcomingSlot(1, 0));
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(noShow));
            when(applicationRepository.existsActiveStandbyOffer(eq(LISTING_ID), eq(APP_ID), any()))
                    .thenReturn(true);

            assertThat(svc().offerAfterNoShow(APP_ID)).isNull();

            org.mockito.InOrder order = inOrder(jobListingRepository, applicationRepository);
            order.verify(jobListingRepository).lockById(LISTING_ID);
            order.verify(applicationRepository).existsActiveStandbyOffer(eq(LISTING_ID), eq(APP_ID), any());
            verify(applicationRepository, never()).findAvailableStandbys(any());
            verify(applicationRepository, never()).save(any());
            verifyNoInteractions(notificationService, smsService);
        }

        @Test
        @DisplayName("Seçilen yedek kilitle taze okunur: arada başka boşluğa çağrıldıysa sıradakine geçilir")
        void freshLockedRead_skipsStandbyOfferedMeanwhile() {
            Application noShow = app(APP_ID, ApplicationStatus.ACCEPTED, upcomingSlot(1, 0));
            Application first = app(77L, ApplicationStatus.STANDBY, upcomingSlot(1, 0));
            Application second = app(78L, ApplicationStatus.STANDBY, upcomingSlot(1, 0));
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(noShow));
            when(shiftSlotRepository.findAllByJobListingId(LISTING_ID)).thenReturn(List.of(upcomingSlot(1, 0)));
            when(applicationRepository.findAvailableStandbys(LISTING_ID)).thenReturn(List.of(first, second));
            jakarta.persistence.EntityManager em = mock(jakarta.persistence.EntityManager.class);
            doAnswer(inv -> {   // eski görüntüde teklifsizdi; güncel satırda başka boşluğa teklif var
                first.setStandbyOfferedAt(LocalDateTime.now().minusMinutes(1));
                first.setStandbyDeadline(LocalDateTime.now().plusHours(3));
                first.setStandbyReplacesApplicationId(41L);
                return null;
            }).when(em).refresh(first, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            org.springframework.test.util.ReflectionTestUtils.setField(svc(), "entityManager", em);

            assertThat(svc().offerAfterNoShow(APP_ID)).isEqualTo(78L);

            assertThat(first.getStandbyReplacesApplicationId()).isEqualTo(41L);
            assertThat(second.getStandbyReplacesApplicationId()).isEqualTo(APP_ID);
            verify(em).refresh(second, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        }

        @Test
        @DisplayName("Taze okumada aynı boşluğa aktif teklif çıkarsa yeni teklif gitmez")
        void freshLockedRead_sameVacancyOffered_skips() {
            Application noShow = app(APP_ID, ApplicationStatus.ACCEPTED, upcomingSlot(1, 0));
            Application first = app(77L, ApplicationStatus.STANDBY, upcomingSlot(1, 0));
            Application second = app(78L, ApplicationStatus.STANDBY, upcomingSlot(1, 0));
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(noShow));
            when(shiftSlotRepository.findAllByJobListingId(LISTING_ID)).thenReturn(List.of(upcomingSlot(1, 0)));
            when(applicationRepository.findAvailableStandbys(LISTING_ID)).thenReturn(List.of(first, second));
            jakarta.persistence.EntityManager em = mock(jakarta.persistence.EntityManager.class);
            doAnswer(inv -> {
                first.setStandbyOfferedAt(LocalDateTime.now().minusMinutes(1));
                first.setStandbyDeadline(LocalDateTime.now().plusHours(3));
                first.setStandbyReplacesApplicationId(APP_ID);
                return null;
            }).when(em).refresh(first, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
            org.springframework.test.util.ReflectionTestUtils.setField(svc(), "entityManager", em);

            assertThat(svc().offerAfterNoShow(APP_ID)).isNull();

            assertThat(second.getStandbyOfferedAt()).isNull();
            verify(applicationRepository, never()).save(any());
            verifyNoInteractions(notificationService, smsService);
        }

        @Test
        @DisplayName("Yedek yoksa null döner ve işletme bilgilendirilir")
        void noStandby_notifiesOwner() {
            Application noShow = app(APP_ID, ApplicationStatus.ACCEPTED, upcomingSlot(1, 0));
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(noShow));
            when(applicationRepository.findAvailableStandbys(LISTING_ID)).thenReturn(List.of());
            when(shiftSlotRepository.findAllByJobListingId(LISTING_ID)).thenReturn(List.of(upcomingSlot(1, 0)));

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
        @DisplayName("Kabul: ACCEPTED olur ve koltuk atomik olarak yeniden dolar")
        void accept_fillsSlot() {
            ShiftSlot slot = upcomingSlot(1, 0);
            Application a = offeredStandby(slot);
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));
            when(shiftSlotRepository.incrementFilledIfAvailable(500L)).thenReturn(1);

            svc().respondToOffer(77L, CANDIDATE_ID, true);

            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
            // Eskiden bellekteki sayac +1 yapilip save ediliyordu (yarisa acik);
            // artik kosullu UPDATE (slotsFilled < slotsNeeded) kullaniliyor.
            verify(shiftSlotRepository).incrementFilledIfAvailable(500L);
            verify(applicationRepository).saveAndFlush(a);
            verify(notificationService).notify(eq(OWNER_ID),
                    eq(NotificationType.STANDBY_FILLED), any(), any(), any());
        }

        @Test
        @DisplayName("İşletme adayı engellediyse kabul reddedilir, slot değişmez")
        void accept_blockedByBusiness_throws() {
            ShiftSlot slot = upcomingSlot(1, 0);
            Application a = offeredStandby(slot);
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));
            when(candidateBlockRepository.existsByBusinessIdAndCandidateId(2L, CANDIDATE_ID)).thenReturn(true);

            assertThatThrownBy(() -> svc().respondToOffer(77L, CANDIDATE_ID, true))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessage("Bu işletmeye başvuru yapamazsın.");
            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.STANDBY);
            assertThat(slot.getSlotsFilled()).isZero();
            verify(shiftSlotRepository, never()).incrementFilledIfAvailable(any());
        }

        @Test
        @DisplayName("Kabul: aday satırı çakışma kontrolünden ve koltuktan önce kilitlenir (READ_COMMITTED)")
        void accept_locksCandidateFirst() throws Exception {
            ShiftSlot slot = upcomingSlot(1, 0);
            Application a = offeredStandby(slot);
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));
            when(shiftSlotRepository.incrementFilledIfAvailable(500L)).thenReturn(1);

            svc().respondToOffer(77L, CANDIDATE_ID, true);

            org.mockito.InOrder order = inOrder(userRepository, applicationRepository, shiftSlotRepository);
            order.verify(userRepository).findByIdForUpdate(CANDIDATE_ID);
            order.verify(applicationRepository).findAllByCandidateIdAndStatus(CANDIDATE_ID, ApplicationStatus.ACCEPTED);
            order.verify(applicationRepository).saveAndFlush(a);
            order.verify(shiftSlotRepository).incrementFilledIfAvailable(500L);

            org.springframework.transaction.annotation.Transactional tx = StandbyService.class
                    .getMethod("respondToOffer", Long.class, Long.class, boolean.class)
                    .getAnnotation(org.springframework.transaction.annotation.Transactional.class);
            assertThat(tx.isolation())
                    .isEqualTo(org.springframework.transaction.annotation.Isolation.READ_COMMITTED);
        }

        @Test
        @DisplayName("Teklif süresi enjekte saatle ölçülür; ret yolunda aday kilitlenmez")
        void deadline_usesInjectedClock_andDeclineDoesNotLock() {
            ShiftSlot slot = upcomingSlot(1, 0);
            Application a = offeredStandby(slot);
            java.time.ZoneId tr = java.time.ZoneId.of("Europe/Istanbul");
            // Saat teklif son tarihinin 1 dk sonrasına sabitlenir: süresi dolmuş sayılmalı.
            svc().clock = java.time.Clock.fixed(
                    a.getStandbyDeadline().plusMinutes(1).atZone(tr).toInstant(), tr);
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));

            assertThatThrownBy(() -> svc().respondToOffer(77L, CANDIDATE_ID, false))
                    .isInstanceOf(com.hotelapp.exception.OfferExpiredException.class);
            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
            verify(userRepository, never()).findByIdForUpdate(any());
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
            when(shiftSlotRepository.findAllByJobListingId(LISTING_ID)).thenReturn(List.of(upcomingSlot(1, 0)));

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
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));

            int n = svc().expireOverdueOffers();

            assertThat(n).isEqualTo(1);
            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
            verify(notificationService).notify(eq(CANDIDATE_ID),
                    eq(NotificationType.STANDBY_OFFER_EXPIRED), any(), any(), any());
            verify(notificationService).notify(eq(OWNER_ID),
                    eq(NotificationType.STANDBY_DECLINED), any(), any(), any());
        }

        @Test
        @DisplayName("Bir teklifte hata olsa da diğer süresi geçen teklifler kapanır")
        void oneFailureDoesNotBlockOthers() {
            Application bad = app(77L, ApplicationStatus.STANDBY, upcomingSlot(1, 0));
            bad.setStandbyOfferedAt(LocalDateTime.now().minusHours(4));
            bad.setStandbyDeadline(LocalDateTime.now().minusHours(1));
            Application ok = app(78L, ApplicationStatus.STANDBY, upcomingSlot(1, 0));
            ok.setStandbyOfferedAt(LocalDateTime.now().minusHours(4));
            ok.setStandbyDeadline(LocalDateTime.now().minusHours(1));
            when(applicationRepository.findByStatusAndStandbyDeadlineBefore(
                    eq(ApplicationStatus.STANDBY), any())).thenReturn(List.of(bad, ok));
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(bad));
            when(applicationRepository.findById(78L)).thenReturn(Optional.of(ok));
            when(applicationRepository.save(bad)).thenThrow(
                    new org.springframework.orm.ObjectOptimisticLockingFailureException(Application.class, 77L));

            int n = svc().expireOverdueOffers();

            assertThat(n).isEqualTo(1);
            assertThat(ok.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
            verify(notificationService, times(1)).notify(eq(CANDIDATE_ID),
                    eq(NotificationType.STANDBY_OFFER_EXPIRED), any(), any(), any());
        }

        @Test
        @DisplayName("Arada cevaplanan teklif (taze okumada STANDBY değil) atlanır")
        void freshReadNoLongerStandby_skipped() {
            Application listed = app(77L, ApplicationStatus.STANDBY);
            listed.setStandbyDeadline(LocalDateTime.now().minusHours(1));
            Application fresh = app(77L, ApplicationStatus.ACCEPTED);
            when(applicationRepository.findByStatusAndStandbyDeadlineBefore(
                    eq(ApplicationStatus.STANDBY), any())).thenReturn(List.of(listed));
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(fresh));

            assertThat(svc().expireOverdueOffers()).isZero();
            assertThat(fresh.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("Sıradaki yedeğe geçiş patlasa da süresi dolma kalıcı ve sayılır")
        void cascadeFailure_keepsExpiry() {
            Application a = app(77L, ApplicationStatus.STANDBY, upcomingSlot(1, 0));
            a.setStandbyOfferedAt(LocalDateTime.now().minusHours(4));
            a.setStandbyDeadline(LocalDateTime.now().minusHours(1));
            a.setStandbyReplacesApplicationId(40L);
            Application b = app(78L, ApplicationStatus.STANDBY, upcomingSlot(1, 0));
            b.setStandbyOfferedAt(LocalDateTime.now().minusHours(4));
            b.setStandbyDeadline(LocalDateTime.now().minusHours(1));
            when(applicationRepository.findByStatusAndStandbyDeadlineBefore(
                    eq(ApplicationStatus.STANDBY), any())).thenReturn(List.of(a, b));
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));
            when(applicationRepository.findById(78L)).thenReturn(Optional.of(b));
            when(applicationRepository.findById(40L)).thenThrow(new RuntimeException("db down"));

            assertThat(svc().expireOverdueOffers()).isEqualTo(2);
            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
            assertThat(b.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
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

    // ================================================================
    // 2. adım — yedek zinciri (Y3, Y4, Y5) ve kapasite (K1)
    // ================================================================
    @Nested
    @DisplayName("yedek zinciri: boşalan slot eşleşmesi, kalıcı EXPIRED, çekilme/çıkarma")
    class Chain {

        private ShiftSlot slot(long id, int needed, int filled) {
            return ShiftSlot.builder().id(id).date(LocalDate.now().plusDays(1))
                    .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0))
                    .slotsNeeded(needed).slotsFilled(filled).build();
        }

        private Application standby(long id, int rank, ShiftSlot... slots) {
            Application a = app(id, ApplicationStatus.STANDBY);
            a.setRequestedSlots(new java.util.HashSet<>(Set.of(slots)));
            a.setStandbyRank(rank);
            return a;
        }

        @Test
        @DisplayName("Y3: teklif yalnız boşalan slotu talep etmiş yedeğe gider (sıra 1 başka slotu istemiş)")
        void offerMatchesVacatedSlot() {
            ShiftSlot morning = slot(500L, 1, 1);
            ShiftSlot evening = slot(501L, 1, 0);   // bosalan koltuk
            Application noShow = app(APP_ID, ApplicationStatus.ACCEPTED);
            Application first = standby(77L, 1, morning);
            Application second = standby(78L, 2, evening);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(noShow));
            when(shiftSlotRepository.findAllById(List.of(501L))).thenReturn(List.of(evening));
            when(applicationRepository.findAvailableStandbys(LISTING_ID)).thenReturn(List.of(first, second));

            Long offered = svc().offerAfterNoShow(APP_ID, List.of(501L));

            assertThat(offered).isEqualTo(78L);
            assertThat(first.getStandbyOfferedAt()).isNull();
            assertThat(second.getStandbyReplacesApplicationId()).isEqualTo(APP_ID);
        }

        @Test
        @DisplayName("Y3: boşalan slot bu arada dolduysa teklif gönderilmez")
        void vacatedSlotAlreadyRefilled_noOffer() {
            Application noShow = app(APP_ID, ApplicationStatus.ACCEPTED);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(noShow));
            when(shiftSlotRepository.findAllById(List.of(501L))).thenReturn(List.of(slot(501L, 1, 1)));

            assertThat(svc().offerAfterNoShow(APP_ID, List.of(501L))).isNull();
            verify(applicationRepository, never()).findAvailableStandbys(any());
        }

        @Test
        @DisplayName("Y4: süresi dolan teklif EXPIRED kalır (noRollbackFor), sıradakine geçilir, bildirim bir kez")
        void expiredOffer_persistsAndCascades() throws Exception {
            ShiftSlot open = slot(500L, 1, 0);
            Application a = standby(77L, 1, open);
            a.setStandbyOfferedAt(LocalDateTime.now().minusHours(4));
            a.setStandbyDeadline(LocalDateTime.now().minusMinutes(1));
            a.setStandbyReplacesApplicationId(APP_ID);
            Application next = standby(78L, 2, open);
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app(APP_ID, ApplicationStatus.ACCEPTED)));
            when(shiftSlotRepository.findAllByJobListingId(LISTING_ID)).thenReturn(List.of(open));
            when(applicationRepository.findAvailableStandbys(LISTING_ID)).thenReturn(List.of(next));

            assertThatThrownBy(() -> svc().respondToOffer(77L, CANDIDATE_ID, true))
                    .isInstanceOf(com.hotelapp.exception.OfferExpiredException.class)
                    .hasMessage("Yedek teklifinin süresi doldu.");

            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
            assertThat(next.getStandbyOfferedAt()).isNotNull();
            verify(notificationService, times(1)).notify(eq(CANDIDATE_ID),
                    eq(NotificationType.STANDBY_OFFER_EXPIRED), any(), any(), any());
            verify(shiftSlotRepository, never()).incrementFilledIfAvailable(any());

            org.springframework.transaction.annotation.Transactional tx = StandbyService.class
                    .getMethod("respondToOffer", Long.class, Long.class, boolean.class)
                    .getAnnotation(org.springframework.transaction.annotation.Transactional.class);
            assertThat(tx.noRollbackFor()).contains(com.hotelapp.exception.OfferExpiredException.class);
        }

        @Test
        @DisplayName("Cevap anında süre dolumu: zincir devamı patlasa da süre dolumu kalıcı, 422 döner")
        void expiredOffer_cascadeFailure_keepsExpiry() {
            Application a = standby(77L, 1, slot(500L, 1, 0));
            a.setStandbyOfferedAt(LocalDateTime.now().minusHours(4));
            a.setStandbyDeadline(LocalDateTime.now().minusMinutes(1));
            a.setStandbyReplacesApplicationId(APP_ID);
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));
            when(applicationRepository.findById(APP_ID)).thenThrow(new RuntimeException("db down"));

            assertThatThrownBy(() -> svc().respondToOffer(77L, CANDIDATE_ID, false))
                    .isInstanceOf(com.hotelapp.exception.OfferExpiredException.class);

            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
            verify(applicationRepository).flush();
        }

        @Test
        @DisplayName("Y4: scheduler zaten EXPIRED olanı tekrar işlemez (tekrar bildirim yok)")
        void scheduler_skipsAlreadyExpired() {
            Application a = app(77L, ApplicationStatus.EXPIRED);
            when(applicationRepository.findByStatusAndStandbyDeadlineBefore(
                    eq(ApplicationStatus.STANDBY), any())).thenReturn(List.of(a));

            assertThat(svc().expireOverdueOffers()).isZero();
            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("Y5: aktif teklifi olan yedek işletmece çıkarılırsa sıradaki yedeğe geçilir")
        void removeStandbyWithActiveOffer_cascades() {
            ShiftSlot open = slot(500L, 1, 0);
            Application a = standby(77L, 1, open);
            a.setStandbyOfferedAt(LocalDateTime.now().minusMinutes(5));
            a.setStandbyDeadline(LocalDateTime.now().plusHours(2));
            a.setStandbyReplacesApplicationId(APP_ID);
            Application next = standby(78L, 2, open);
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app(APP_ID, ApplicationStatus.ACCEPTED)));
            when(shiftSlotRepository.findAllByJobListingId(LISTING_ID)).thenReturn(List.of(open));
            when(applicationRepository.findAvailableStandbys(LISTING_ID)).thenReturn(List.of(next));

            svc().removeStandby(77L, OWNER_ID);

            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.REVIEWING);
            assertThat(next.getStandbyReplacesApplicationId()).isEqualTo(APP_ID);
        }

        @Test
        @DisplayName("Y5: teklifi olmayan yedek çıkarılırsa zincir tetiklenmez")
        void removeStandbyWithoutOffer_noCascade() {
            Application a = standby(77L, 1, slot(500L, 1, 0));
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));

            svc().removeStandby(77L, OWNER_ID);

            verify(applicationRepository, never()).findAvailableStandbys(any());
        }

        @Test
        @DisplayName("K1: yedek kabulünde yalnız alınabilen koltuk atanır; dolu slot başvurudan çıkar")
        void accept_keepsOnlyClaimedSeats() {
            ShiftSlot full = slot(500L, 1, 1);
            ShiftSlot open = slot(501L, 1, 0);
            Application a = standby(77L, 1, full, open);
            a.setStandbyOfferedAt(LocalDateTime.now().minusMinutes(5));
            a.setStandbyDeadline(LocalDateTime.now().plusHours(2));
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));
            when(shiftSlotRepository.incrementFilledIfAvailable(500L)).thenReturn(0);
            when(shiftSlotRepository.incrementFilledIfAvailable(501L)).thenReturn(1);

            svc().respondToOffer(77L, CANDIDATE_ID, true);

            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
            assertThat(a.getRequestedSlots()).containsExactly(open);
            var order = inOrder(shiftSlotRepository);
            order.verify(shiftSlotRepository).incrementFilledIfAvailable(500L);
            order.verify(shiftSlotRepository).incrementFilledIfAvailable(501L);
        }

        @Test
        @DisplayName("K1: yedek kabulünde hiç koltuk alınamazsa 422 'Bu vardiya doldu'")
        void accept_noSeat_throws() {
            Application a = standby(77L, 1, slot(500L, 1, 0));
            a.setStandbyOfferedAt(LocalDateTime.now().minusMinutes(5));
            a.setStandbyDeadline(LocalDateTime.now().plusHours(2));
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));
            when(shiftSlotRepository.incrementFilledIfAvailable(500L)).thenReturn(0);   // yaris kaybedildi

            assertThatThrownBy(() -> svc().respondToOffer(77L, CANDIDATE_ID, true))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("Bu vardiya doldu");
        }
    }

    // ================================================================
    @Nested
    @DisplayName("Kabul kapısı ve askıdaki ilan (Y5/O6/O7)")
    class AcceptanceGate {

        private Application offered(ShiftSlot slot) {
            Application a = app(77L, ApplicationStatus.STANDBY, slot);
            a.setStandbyOfferedAt(LocalDateTime.now().minusMinutes(10));
            a.setStandbyDeadline(LocalDateTime.now().plusHours(2));
            a.setStandbyReplacesApplicationId(APP_ID);
            return a;
        }

        @Test
        @DisplayName("Askıya alınmış ilanda yedek teklifi kabul edilemez, koltuk alınmaz")
        void acceptOnSuspendedListing_throws() {
            Application a = offered(upcomingSlot(1, 0));
            a.getJobListing().setAdminSuspended(true);
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));

            assertThatThrownBy(() -> svc().respondToOffer(77L, CANDIDATE_ID, true))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessage(AcceptanceGuard.LISTING_NOT_ACTIVE);
            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.STANDBY);
            verify(shiftSlotRepository, never()).incrementFilledIfAvailable(any());
        }

        @Test
        @DisplayName("Aday aynı saatte başka bir kabul edilmiş vardiyadaysa yedek teklifi kabul edilemez")
        void acceptWithOverlappingShift_throws() {
            ShiftSlot mine = upcomingSlot(1, 0);   // yarın 08-16
            Application a = offered(mine);
            ShiftSlot other = ShiftSlot.builder().id(900L).date(mine.getDate())
                    .startTime(LocalTime.of(12, 0)).endTime(LocalTime.of(20, 0)).slotsNeeded(1).slotsFilled(1).build();
            Application acceptedElsewhere = Application.builder().id(5L).status(ApplicationStatus.ACCEPTED)
                    .candidate(user(CANDIDATE_ID)).jobListing(listing())
                    .requestedSlots(new java.util.HashSet<>(Set.of(other))).build();
            when(applicationRepository.findById(77L)).thenReturn(Optional.of(a));
            when(applicationRepository.findAllByCandidateIdAndStatus(CANDIDATE_ID, ApplicationStatus.ACCEPTED))
                    .thenReturn(List.of(acceptedElsewhere));

            assertThatThrownBy(() -> svc().respondToOffer(77L, CANDIDATE_ID, true))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("başka bir vardiyada");
            verify(shiftSlotRepository, never()).incrementFilledIfAvailable(any());
        }

        @Test
        @DisplayName("Askıdaki ya da duraklatılmış ilanda yedek zinciri tetiklenmez")
        void offerAfterNoShow_onSuspendedOrClosedListing_skips() {
            Application noShow = app(APP_ID, ApplicationStatus.ACCEPTED);
            noShow.getJobListing().setAdminSuspended(true);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(noShow));

            assertThat(svc().offerAfterNoShow(APP_ID, List.of(500L))).isNull();

            noShow.getJobListing().setAdminSuspended(false);
            noShow.getJobListing().setStatus(com.hotelapp.enums.ListingStatus.CLOSED);
            assertThat(svc().offerAfterNoShow(APP_ID, List.of(500L))).isNull();

            verify(applicationRepository, never()).findAvailableStandbys(any());
            verifyNoInteractions(notificationService, smsService);
        }
    }
}
