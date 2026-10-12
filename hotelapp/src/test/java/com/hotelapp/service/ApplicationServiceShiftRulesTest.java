package com.hotelapp.service;

import com.hotelapp.dto.ApplicationRequest;
import com.hotelapp.dto.ReviewRequest;
import com.hotelapp.entity.*;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.event.NoShowMarkedEvent;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.OfferExpiredException;
import com.hotelapp.repository.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * 2. adım — kapasite yarışı (K1), mükerrer başvuru (Y1), HOLD süresi (Y4),
 * yedek zinciri (Y5) ve no-show kuralları (Y2) + gece vardiyası.
 */
@ExtendWith(MockitoExtension.class)
class ApplicationServiceShiftRulesTest {

    @Mock private ApplicationRepository applicationRepository;
    @Mock private UserRepository userRepository;
    @Mock private JobListingRepository jobListingRepository;
    @Mock private ShiftSlotRepository shiftSlotRepository;
    @Mock private CandidateBlockRepository candidateBlockRepository;
    @Mock private OutboxService outboxService;
    @Mock private NotificationService notificationService;
    @Mock private MessageService messageService;
    @Mock private EmailService emailService;
    @Mock private EmailTemplates emailTemplates;
    @Mock private ApplicationEventPublisher eventPublisher;
    @Mock private ApplicationMapper applicationMapper;
    @Mock private org.springframework.beans.factory.ObjectProvider<com.hotelapp.metrics.AppMetrics> metricsProvider;
    @Mock private StandbyService standbyService;
    @Mock private WorkSessionRepository workSessionRepository;
    @Mock private ApplicationNoShowSlotRepository noShowSlotRepository;

    @InjectMocks private ApplicationService service;

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDate DAY = LocalDate.of(2026, 10, 3);
    private static final Long CANDIDATE_ID = 7L, OWNER_ID = 11L, LISTING_ID = 22L, APP_ID = 33L;

    private void at(LocalDateTime t) {
        service.clock = Clock.fixed(t.atZone(TR).toInstant(), TR);
    }

    private User candidate() {
        return User.builder().id(CANDIDATE_ID).email("aday@test.com").fullName("Test Aday").strikesRemaining(3).build();
    }

    private JobListing listing() {
        Business b = Business.builder().id(1L).name("Test Otel")
                .owner(User.builder().id(OWNER_ID).email("isletme@test.com").build()).build();
        return JobListing.builder().id(LISTING_ID).title("Gece Resepsiyon").status(ListingStatus.ACTIVE).business(b).build();
    }

    private static ShiftSlot slot(long id, LocalDate date, int sh, int eh) {
        return ShiftSlot.builder().id(id).date(date)
                .startTime(LocalTime.of(sh, 0)).endTime(LocalTime.of(eh, 0))
                .slotsNeeded(1).slotsFilled(1).build();
    }

    private Application app(ApplicationStatus status, ShiftSlot... slots) {
        return Application.builder().id(APP_ID).status(status).candidate(candidate()).jobListing(listing())
                .requestedSlots(new HashSet<>(Set.of(slots))).build();
    }

    // ================================================================
    @Nested
    @DisplayName("Y1 — mükerrer başvuru")
    class Duplicate {

        @Test
        @DisplayName("HELD ve STANDBY de aktif sayılır; durum listesi sorguya gider")
        void activeStatusesIncludeHeldAndStandby() {
            assertThat(ApplicationService.ACTIVE_FOR_DUPLICATE).contains(
                    ApplicationStatus.PENDING, ApplicationStatus.REVIEWING, ApplicationStatus.HELD,
                    ApplicationStatus.STANDBY, ApplicationStatus.ACCEPTED);
        }

        @Test
        @DisplayName("HELD başvuru varken ikinci başvuru: dupHeld anahtarı")
        void heldDuplicate_throws() {
            assertDuplicate(ApplicationStatus.HELD, "error.application.dupHeld");
        }

        @Test
        @DisplayName("STANDBY başvuru varken ikinci başvuru: dupStandby anahtarı")
        void standbyDuplicate_throws() {
            assertDuplicate(ApplicationStatus.STANDBY, "error.application.dupStandby");
        }

        @SuppressWarnings("unchecked")
        private void assertDuplicate(ApplicationStatus existing, String key) {
            when(userRepository.findById(CANDIDATE_ID)).thenReturn(Optional.of(candidate()));
            when(jobListingRepository.findById(LISTING_ID)).thenReturn(Optional.of(listing()));
            ArgumentCaptor<Collection<ApplicationStatus>> statuses = ArgumentCaptor.forClass(Collection.class);
            when(applicationRepository.findFirstByCandidateIdAndJobListingIdAndStatusIn(
                    anyLong(), anyLong(), statuses.capture())).thenReturn(Optional.of(app(existing)));
            ApplicationRequest req = new ApplicationRequest();
            req.setJobListingId(LISTING_ID);

            assertThatThrownBy(() -> service.createApplication(CANDIDATE_ID, req))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining(key);
            assertThat(statuses.getValue()).contains(existing);
            verify(applicationRepository, never()).save(any());
        }
    }

    // ================================================================
    @Nested
    @DisplayName("K1 — slot kapasitesi atomik")
    class Capacity {

        private ReviewRequest accept() {
            ReviewRequest r = new ReviewRequest();
            r.setDecision(ApplicationStatus.ACCEPTED);
            return r;
        }

        @Test
        @DisplayName("Kabul: önce başvuru flush (iyimser kilit), sonra slotlar id sırasıyla koşullu artırılır")
        void accept_claimsSeatsInIdOrder() {
            ShiftSlot b = slot(902L, DAY.plusDays(2), 8, 16);
            ShiftSlot a = slot(901L, DAY.plusDays(1), 8, 16);
            Application app = app(ApplicationStatus.REVIEWING, b, a);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app));
            when(shiftSlotRepository.incrementFilledIfAvailable(anyLong())).thenReturn(1);

            service.reviewApplication(APP_ID, OWNER_ID, accept());

            InOrder order = inOrder(applicationRepository, shiftSlotRepository);
            order.verify(applicationRepository).saveAndFlush(app);
            order.verify(shiftSlotRepository).incrementFilledIfAvailable(901L);
            order.verify(shiftSlotRepository).incrementFilledIfAvailable(902L);
            assertThat(app.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
        }

        @Test
        @DisplayName("Kabul: ikinci slot dolduysa 422 'Bu vardiya doldu' (transaction geri alınır), bildirim/audit yok")
        void accept_secondSlotFull_throws() {
            ShiftSlot a = slot(901L, DAY.plusDays(1), 8, 16);
            ShiftSlot b = slot(902L, DAY.plusDays(2), 8, 16);
            Application app = app(ApplicationStatus.REVIEWING, a, b);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app));
            when(shiftSlotRepository.incrementFilledIfAvailable(901L)).thenReturn(1);
            when(shiftSlotRepository.incrementFilledIfAvailable(902L)).thenReturn(0);

            assertThatThrownBy(() -> service.reviewApplication(APP_ID, OWNER_ID, accept()))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("Bu vardiya doldu");
            verify(outboxService, never()).appendAuditLog(any());
            verifyNoInteractions(notificationService);
        }

        @Test
        @DisplayName("HOLD onayı: slot dolduysa 422, audit/bildirim yok")
        void holdAccept_full_throws() {
            Application app = app(ApplicationStatus.HELD, slot(901L, DAY.plusDays(1), 8, 16));
            app.setHoldDeadline(LocalDateTime.now().plusHours(5));
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app));
            when(shiftSlotRepository.incrementFilledIfAvailable(901L)).thenReturn(0);

            assertThatThrownBy(() -> service.respondToHold(APP_ID, CANDIDATE_ID, true))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("Bu vardiya doldu");
            verify(outboxService, never()).appendAuditLog(any());
        }
    }

    // ================================================================
    @Nested
    @DisplayName("Y4/Y5 — HOLD süresi ve yedek zinciri")
    class HoldAndChain {

        @Test
        @DisplayName("Süresi dolan HOLD: EXPIRED kalıcı (noRollbackFor), 422 holdExpired")
        void expiredHold_persists() throws Exception {
            Application app = app(ApplicationStatus.HELD);
            app.setHoldDeadline(LocalDateTime.now().minusMinutes(1));
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(app));

            assertThatThrownBy(() -> service.respondToHold(APP_ID, CANDIDATE_ID, true))
                    .isInstanceOf(OfferExpiredException.class)
                    .hasMessageContaining("error.application.holdExpired");
            assertThat(app.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
            verify(applicationRepository).save(app);

            Transactional tx = ApplicationService.class
                    .getMethod("respondToHold", Long.class, Long.class, boolean.class)
                    .getAnnotation(Transactional.class);
            assertThat(tx.noRollbackFor()).contains(OfferExpiredException.class);
        }

        private Application offeredStandby() {
            Application a = app(ApplicationStatus.STANDBY);
            a.setStandbyRank(1);
            a.setStandbyOfferedAt(LocalDateTime.now().minusMinutes(5));
            a.setStandbyDeadline(LocalDateTime.now().plusHours(2));
            a.setStandbyReplacesApplicationId(99L);
            return a;
        }

        @Test
        @DisplayName("Aktif teklifi olan yedek çekilirse sıradaki yedeğe geçilir")
        void withdrawOfferedStandby_cascades() {
            Application a = offeredStandby();
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));

            service.withdrawApplication(APP_ID, CANDIDATE_ID);

            assertThat(a.getStatus()).isEqualTo(ApplicationStatus.WITHDRAWN);
            assertThat(a.getStandbyReplacesApplicationId()).isNull();
            verify(standbyService).offerAfterNoShow(99L);
        }

        @Test
        @DisplayName("Aktif teklifi olan yedek işletmece reddedilirse sıradaki yedeğe geçilir")
        void rejectOfferedStandby_cascades() {
            Application a = offeredStandby();
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));
            ReviewRequest r = new ReviewRequest();
            r.setDecision(ApplicationStatus.REJECTED);

            service.reviewApplication(APP_ID, OWNER_ID, r);

            verify(standbyService).offerAfterNoShow(99L);
            verify(shiftSlotRepository, never()).incrementFilledIfAvailable(anyLong());
        }

        @Test
        @DisplayName("Teklifsiz yedek çekilirse zincir tetiklenmez")
        void withdrawPlainStandby_noCascade() {
            Application a = app(ApplicationStatus.STANDBY);
            when(applicationRepository.findById(APP_ID)).thenReturn(Optional.of(a));

            service.withdrawApplication(APP_ID, CANDIDATE_ID);

            verifyNoInteractions(standbyService);
        }
    }

    // ================================================================
    @Nested
    @DisplayName("Y2 — no-show kuralları (vardiya bazında, V25; gece vardiyası dahil)")
    class NoShow {

        private void marksPersist() {
            when(noShowSlotRepository.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        }

        private java.util.Set<Long> marked(Application app) {
            return NoShowSlots.ids(app);
        }

        @Test
        @DisplayName("Vardiya başlangıcı + 30 dk geçmeden işaretlenemez")
        void beforeGrace_refused() {
            ShiftSlot night = slot(901L, DAY, 22, 6);
            Application app = app(ApplicationStatus.ACCEPTED, night);
            when(applicationRepository.findByIdForCheckIn(APP_ID)).thenReturn(Optional.of(app));
            at(DAY.atTime(22, 20));

            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("30 dakika sonra");
            assertThat(app.isNoShow()).isFalse();
            verify(shiftSlotRepository, never()).decrementFilled(anyLong());
            verify(noShowSlotRepository, never()).saveAndFlush(any());
            verify(eventPublisher, never()).publishEvent(any());
        }

        @Test
        @DisplayName("Gece vardiyası 22:00–06:00: ertesi gün 06:31'de işaretlenir; satır eklenir, koltuk boşalır, slot başvuruda KALIR")
        void overnight_afterEnd_marks() {
            ShiftSlot night = slot(901L, DAY, 22, 6);
            Application app = app(ApplicationStatus.ACCEPTED, night);
            when(applicationRepository.findByIdForCheckIn(APP_ID)).thenReturn(Optional.of(app));
            marksPersist();
            at(DAY.plusDays(1).atTime(6, 31));

            var result = service.markNoShow(APP_ID, OWNER_ID);

            assertThat(app.isNoShow()).isTrue();
            assertThat(app.getRequestedSlots()).containsExactly(night);
            assertThat(marked(app)).containsExactly(901L);
            assertThat(result.getCandidateStrikesRemaining()).isEqualTo(2);
            verify(shiftSlotRepository).decrementFilled(901L);
            ArgumentCaptor<ApplicationNoShowSlot> row = ArgumentCaptor.forClass(ApplicationNoShowSlot.class);
            verify(noShowSlotRepository).saveAndFlush(row.capture());
            assertThat(row.getValue().getApplication()).isSameAs(app);
            assertThat(row.getValue().getShiftSlot()).isSameAs(night);
            assertThat(row.getValue().getMarkedAt()).isEqualTo(DAY.plusDays(1).atTime(6, 31));
            ArgumentCaptor<NoShowMarkedEvent> ev = ArgumentCaptor.forClass(NoShowMarkedEvent.class);
            verify(eventPublisher).publishEvent(ev.capture());
            assertThat(ev.getValue().vacatedSlotIds()).containsExactly(901L);
        }

        @Test
        @DisplayName("Giriş kaydı olan vardiya işaretlenemez (QR/elle/GPS)")
        void withEntry_refused() {
            ShiftSlot night = slot(901L, DAY, 22, 6);
            Application app = app(ApplicationStatus.ACCEPTED, night);
            when(applicationRepository.findByIdForCheckIn(APP_ID)).thenReturn(Optional.of(app));
            when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(APP_ID)).thenReturn(List.of(
                    WorkSession.builder().shiftSlotId(901L).clockInAt(DAY.atTime(23, 30)).build()));
            at(DAY.plusDays(1).atTime(2, 0));

            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID, 901L))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("giriş kaydı var");
            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("giriş kaydı var");
            verify(shiftSlotRepository, never()).decrementFilled(anyLong());
            verify(noShowSlotRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("QA regresyonu: slotId'siz işaret QR kullanmayan işletmede önceki günlerde çalışılmış vardiyaları boşaltmaz")
        void noShowWithoutSlotId_doesNotVacatePastWorkedSlots() {
            // 3 günlük başvuru; işletme giriş kaydı tutmuyor (hiç WorkSession yok).
            ShiftSlot day1 = slot(901L, DAY.minusDays(2), 8, 16);
            ShiftSlot day2 = slot(902L, DAY.minusDays(1), 8, 16);
            ShiftSlot day3 = slot(903L, DAY, 8, 16);
            Application app = app(ApplicationStatus.ACCEPTED, day1, day2, day3);
            when(applicationRepository.findByIdForCheckIn(APP_ID)).thenReturn(Optional.of(app));
            marksPersist();
            at(DAY.atTime(9, 0));   // 3. gün devam ediyor, aday yok

            service.markNoShow(APP_ID, OWNER_ID);

            verify(shiftSlotRepository).decrementFilled(903L);
            verify(shiftSlotRepository, never()).decrementFilled(901L);
            verify(shiftSlotRepository, never()).decrementFilled(902L);
            assertThat(app.getRequestedSlots()).containsExactlyInAnyOrder(day1, day2, day3);
            assertThat(marked(app)).containsExactly(903L);
        }

        @Test
        @DisplayName("slotId'siz: devam eden vardiya yoksa en son başlamış (bitmiş) vardiya seçilir, daha eskisi değil")
        void withoutSlotId_picksLatestStartedEvenIfEnded() {
            ShiftSlot older = slot(901L, DAY.minusDays(1), 8, 16);
            ShiftSlot latest = slot(902L, DAY, 8, 16);
            ShiftSlot future = slot(903L, DAY.plusDays(1), 8, 16);
            Application app = app(ApplicationStatus.ACCEPTED, older, latest, future);
            when(applicationRepository.findByIdForCheckIn(APP_ID)).thenReturn(Optional.of(app));
            marksPersist();
            at(DAY.atTime(20, 0));   // bugünkü vardiya 16:00'da bitti

            service.markNoShow(APP_ID, OWNER_ID);

            assertThat(marked(app)).containsExactly(902L);
            verify(shiftSlotRepository).decrementFilled(902L);
            verify(shiftSlotRepository, times(1)).decrementFilled(anyLong());
        }

        @Test
        @DisplayName("slotId'siz: en son vardiyada giriş varsa ya da zaten işaretliyse eski vardiyaya düşülmez (422)")
        void withoutSlotId_latestNotEligible_noFallbackToOlder() {
            ShiftSlot older = slot(901L, DAY.minusDays(1), 8, 16);
            ShiftSlot latest = slot(902L, DAY, 8, 16);
            Application app = app(ApplicationStatus.ACCEPTED, older, latest);
            when(applicationRepository.findByIdForCheckIn(APP_ID)).thenReturn(Optional.of(app));
            when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(APP_ID)).thenReturn(List.of(
                    WorkSession.builder().shiftSlotId(902L).clockInAt(DAY.atTime(7, 55)).build()));
            at(DAY.atTime(9, 0));

            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("giriş kaydı var");

            // Bugünkü vardiya zaten işaretli: slotId'siz ikinci çağrı dünküne kaymaz
            Application app2 = app(ApplicationStatus.ACCEPTED, older, latest);
            app2.setNoShow(true);
            app2.getNoShowSlots().add(ApplicationNoShowSlot.builder().application(app2).shiftSlot(latest).build());
            when(applicationRepository.findByIdForCheckIn(APP_ID)).thenReturn(Optional.of(app2));
            when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(APP_ID)).thenReturn(List.of());

            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessage(ApplicationService.NO_SHOW_ALREADY_MARKED);
            verify(shiftSlotRepository, never()).decrementFilled(anyLong());
            verify(noShowSlotRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("Ceza vardiya başına: her yeni işaret 1 strike; 3. işarette 30 gün ban + 3'e reset; aynı vardiya ikinci kez 422")
        void perShiftStrike_andSameSlotTwiceRefused() {
            ShiftSlot first = slot(901L, DAY, 8, 16);
            ShiftSlot second = slot(902L, DAY.plusDays(1), 8, 16);
            ShiftSlot third = slot(903L, DAY.plusDays(2), 8, 16);
            Application app = app(ApplicationStatus.ACCEPTED, first, second, third);
            when(applicationRepository.findByIdForCheckIn(APP_ID)).thenReturn(Optional.of(app));
            marksPersist();

            at(DAY.atTime(9, 0));
            var r1 = service.markNoShow(APP_ID, OWNER_ID, 901L);
            assertThat(r1.getCandidateStrikesRemaining()).isEqualTo(2);
            assertThat(r1.getAutoBanned()).isFalse();

            at(DAY.plusDays(1).atTime(9, 0));
            var r2 = service.markNoShow(APP_ID, OWNER_ID, 902L);
            assertThat(r2.getCandidateStrikesRemaining()).isEqualTo(1);
            assertThat(r2.getAutoBanned()).isFalse();

            // Aynı vardiya ikinci kez: 422, koltuk iki kez boşalmaz, strike düşmez
            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID, 902L))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessage(ApplicationService.NO_SHOW_ALREADY_MARKED);
            verify(shiftSlotRepository, times(1)).decrementFilled(902L);
            assertThat(app.getCandidate().getStrikesRemaining()).isEqualTo(1);

            at(DAY.plusDays(2).atTime(9, 0));
            var r3 = service.markNoShow(APP_ID, OWNER_ID, 903L);
            assertThat(r3.getAutoBanned()).isTrue();
            assertThat(r3.getBannedUntil()).isNotNull();
            assertThat(r3.getCandidateStrikesRemaining()).isEqualTo(3);

            assertThat(app.getRequestedSlots()).containsExactlyInAnyOrder(first, second, third);
            assertThat(marked(app)).containsExactlyInAnyOrder(901L, 902L, 903L);
            verify(eventPublisher, times(3)).publishEvent(any(NoShowMarkedEvent.class));
        }

        @Test
        @DisplayName("UNIQUE ihlali (eşzamanlı ikinci işaret) 422'ye çevrilir; koltuk boşalmaz, strike düşmez")
        void uniqueViolation_mapsTo422_withoutRelease() {
            ShiftSlot s = slot(901L, DAY, 8, 16);
            Application app = app(ApplicationStatus.ACCEPTED, s);
            when(applicationRepository.findByIdForCheckIn(APP_ID)).thenReturn(Optional.of(app));
            when(noShowSlotRepository.saveAndFlush(any()))
                    .thenThrow(new org.springframework.dao.DataIntegrityViolationException("uk_anss_application_slot"));
            at(DAY.atTime(9, 0));

            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID, 901L))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessage(ApplicationService.NO_SHOW_ALREADY_MARKED);
            verify(shiftSlotRepository, never()).decrementFilled(anyLong());
            assertThat(app.getCandidate().getStrikesRemaining()).isEqualTo(3);
            verify(eventPublisher, never()).publishEvent(any());
        }

        @Test
        @DisplayName("V25 öncesi no-show (satır yok) tekrar işaretlenemez — eski akışta tüm koltuklar boşaltıldı")
        void legacyMarked_refused() {
            Application app = app(ApplicationStatus.ACCEPTED, slot(901L, DAY, 8, 16));
            app.setNoShow(true);
            when(applicationRepository.findByIdForCheckIn(APP_ID)).thenReturn(Optional.of(app));
            at(DAY.atTime(9, 0));

            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("zaten no-show");
            assertThatThrownBy(() -> service.markNoShow(APP_ID, OWNER_ID, 901L))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("zaten no-show");
            verify(shiftSlotRepository, never()).decrementFilled(anyLong());
            verify(noShowSlotRepository, never()).saveAndFlush(any());
        }

        @Test
        @DisplayName("Slotsuz eski başvuru: önceki davranış (işaretlenir, slot/satır işlemi yok)")
        void legacySlotless_marks() {
            Application app = app(ApplicationStatus.ACCEPTED);
            when(applicationRepository.findByIdForCheckIn(APP_ID)).thenReturn(Optional.of(app));

            service.markNoShow(APP_ID, OWNER_ID);

            assertThat(app.isNoShow()).isTrue();
            assertThat(app.getCandidate().getStrikesRemaining()).isEqualTo(2);
            verifyNoInteractions(shiftSlotRepository, noShowSlotRepository);
        }
    }
}
