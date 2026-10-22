package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.ApplicationNoShowSlot;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.ShiftSlotRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Hesap kapanışı / askıya alma: açık başvurular geri çekilir, gelecek vardiyalar
 * boşalır (koltuk + işletme bildirimi + yedek zinciri), geçmiş vardiyalar korunur.
 */
@ExtendWith(MockitoExtension.class)
class AccountClosureServiceTest {

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 16, 12, 0);
    private static final Long CANDIDATE_ID = 7L;
    private static final Long OWNER_ID = 11L;

    @Mock private ApplicationRepository applicationRepository;
    @Mock private ShiftSlotRepository shiftSlotRepository;
    @Mock private JobListingRepository jobListingRepository;
    @Mock private JobListingService jobListingService;
    @Mock private StandbyService standbyService;
    @Mock private NotificationService notificationService;
    @Mock private OutboxService outboxService;
    @Mock private EntityManager entityManager;

    private AccountClosureService service;

    @BeforeEach
    void setUp() {
        service = new AccountClosureService(applicationRepository, shiftSlotRepository, jobListingRepository,
                jobListingService, standbyService, notificationService, outboxService);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        service.clock = Clock.fixed(NOW.atZone(TR).toInstant(), TR);
    }

    private static ShiftSlot slot(long id, LocalDate date) {
        return ShiftSlot.builder().id(id).date(date)
                .startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(17, 0))
                .slotsNeeded(2).slotsFilled(2).build();
    }

    private static JobListing listing(long id, ListingStatus status) {
        User owner = User.builder().id(OWNER_ID).email("isletme@test.com").fullName("Sahip").build();
        Business b = Business.builder().id(1L).name("Otel").owner(owner).build();
        return JobListing.builder().id(id).title("Garson").status(status).business(b).build();
    }

    private static Application app(long id, ApplicationStatus status, JobListing listing, ShiftSlot... slots) {
        return Application.builder().id(id).status(status)
                .candidate(User.builder().id(CANDIDATE_ID).fullName("Test Aday").build())
                .jobListing(listing)
                .requestedSlots(new HashSet<>(Set.of(slots)))
                .build();
    }

    @Test
    @DisplayName("Açık başvurular WITHDRAWN; aktif yedek teklifi varsa zincir sıradaki yedeğe geçer")
    void openApplications_withdrawn_andChainContinues() {
        JobListing l = listing(22L, ListingStatus.ACTIVE);
        Application pending = app(1L, ApplicationStatus.PENDING, l);
        Application held = app(2L, ApplicationStatus.HELD, l);
        held.setHoldDeadline(NOW.plusHours(5));
        Application offered = app(3L, ApplicationStatus.STANDBY, l);
        offered.setStandbyOfferedAt(NOW.minusHours(1));
        offered.setStandbyReplacesApplicationId(99L);
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(List.of(pending, held, offered));

        var result = service.releaseCandidate(CANDIDATE_ID, null, AccountClosureService.Reason.ACCOUNT_CLOSED);

        assertThat(List.of(pending, held, offered)).allMatch(a -> a.getStatus() == ApplicationStatus.WITHDRAWN);
        assertThat(held.getHoldDeadline()).isNull();
        assertThat(offered.getStandbyReplacesApplicationId()).isNull();
        assertThat(result.withdrawnApplications()).isEqualTo(3);
        verify(standbyService).offerAfterNoShow(99L);
        verify(shiftSlotRepository, never()).decrementFilled(anyLong());
    }

    @Test
    @DisplayName("Silme: gelecek ACCEPTED vardiya boşalır + işletmeye bildirim + boşalan slotla yedek teklifi")
    void acceptedFuture_vacated_notifiesBusiness_andOffersStandby() {
        JobListing l = listing(22L, ListingStatus.ACTIVE);
        ShiftSlot future = slot(500L, LocalDate.of(2026, 10, 20));
        Application accepted = app(5L, ApplicationStatus.ACCEPTED, l, future);
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(List.of(accepted));

        var result = service.releaseCandidate(CANDIDATE_ID, null, AccountClosureService.Reason.ACCOUNT_CLOSED);

        assertThat(accepted.getStatus()).isEqualTo(ApplicationStatus.WITHDRAWN);
        assertThat(accepted.getRequestedSlots()).containsExactly(future);   // kayıt kalır, koltuk tutmaz
        assertThat(result.vacatedShifts()).isEqualTo(1);
        verify(shiftSlotRepository).decrementFilled(500L);
        verify(entityManager).refresh(future);
        verify(standbyService).offerAfterNoShow(5L, List.of(500L));

        ArgumentCaptor<String> title = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> msg = ArgumentCaptor.forClass(String.class);
        verify(notificationService).notify(eq(OWNER_ID), eq(NotificationType.APPLICATION_WITHDRAWN),
                title.capture(), msg.capture(), eq("applications"));
        assertThat(title.getValue()).isEqualTo("Aday hesabını kapattı");
        assertThat(msg.getValue()).contains("Test Aday", "Garson", "2026-10-20", "vardiyası boşaldı");
    }

    @Test
    @DisplayName("Karışık başvuru: geçmiş vardiya ve kazanç kaydı korunur (ACCEPTED kalır), yalnız gelecek çıkar")
    void mixedPastAndFuture_keepsPastShift() {
        JobListing l = listing(22L, ListingStatus.ACTIVE);
        ShiftSlot past = slot(400L, LocalDate.of(2026, 10, 10));
        ShiftSlot future = slot(500L, LocalDate.of(2026, 10, 20));
        Application accepted = app(5L, ApplicationStatus.ACCEPTED, l, past, future);
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(List.of(accepted));

        service.releaseCandidate(CANDIDATE_ID, null, AccountClosureService.Reason.ACCOUNT_CLOSED);

        assertThat(accepted.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
        assertThat(accepted.getRequestedSlots()).containsExactly(past);
        verify(shiftSlotRepository).decrementFilled(500L);
        verify(shiftSlotRepository, never()).decrementFilled(400L);
    }

    @Test
    @DisplayName("Yalnız geçmiş/başlamış vardiyalar: hiçbir şey değişmez, bildirim yok")
    void onlyPastOrOngoing_untouched() {
        JobListing l = listing(22L, ListingStatus.ACTIVE);
        ShiftSlot past = slot(400L, LocalDate.of(2026, 10, 10));
        ShiftSlot ongoing = slot(401L, LocalDate.of(2026, 10, 16));   // 09:00 başladı, NOW 12:00
        Application accepted = app(5L, ApplicationStatus.ACCEPTED, l, past, ongoing);
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(List.of(accepted));

        var result = service.releaseCandidate(CANDIDATE_ID, null, AccountClosureService.Reason.ACCOUNT_CLOSED);

        assertThat(accepted.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
        assertThat(accepted.getRequestedSlots()).hasSize(2);
        assertThat(result).isEqualTo(AccountClosureService.Result.NONE);
        verify(shiftSlotRepository, never()).decrementFilled(anyLong());
        verify(notificationService, never()).notify(any(), any(), any(), any(), any());
        verify(outboxService, never()).appendAuditLog(any());
    }

    @Test
    @DisplayName("Ban: yalnız ban bitişinden önce başlayan gelecek vardiyalar boşalır; sonrası korunur")
    void suspension_onlyShiftsBeforeBanEnd() {
        JobListing l = listing(22L, ListingStatus.ACTIVE);
        ShiftSlot inBan = slot(500L, LocalDate.of(2026, 10, 20));
        ShiftSlot afterBan = slot(501L, LocalDate.of(2026, 12, 1));
        Application accepted = app(5L, ApplicationStatus.ACCEPTED, l, inBan, afterBan);
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(List.of(accepted));

        service.releaseCandidate(CANDIDATE_ID, NOW.plusDays(30), AccountClosureService.Reason.SUSPENDED);

        assertThat(accepted.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
        assertThat(accepted.getRequestedSlots()).containsExactly(afterBan);
        verify(shiftSlotRepository).decrementFilled(500L);
        verify(shiftSlotRepository, never()).decrementFilled(501L);
        verify(standbyService).offerAfterNoShow(5L, List.of(500L));
        ArgumentCaptor<String> msg = ArgumentCaptor.forClass(String.class);
        verify(notificationService).notify(eq(OWNER_ID), eq(NotificationType.APPLICATION_WITHDRAWN),
                eq("Aday vardiyaya katılamayacak"), msg.capture(), eq("applications"));
        assertThat(msg.getValue()).doesNotContainPattern("(?i)ban|strike|no-show");
    }

    @Test
    @DisplayName("Askıya alınmış ilanda vardiya boşalır ama yedek zinciri tetiklenmez")
    void suspendedListing_noStandbyOffer() {
        JobListing l = listing(22L, ListingStatus.PAUSED);
        l.setAdminSuspended(true);
        Application accepted = app(5L, ApplicationStatus.ACCEPTED, l, slot(500L, LocalDate.of(2026, 10, 20)));
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(List.of(accepted));

        service.releaseCandidate(CANDIDATE_ID, null, AccountClosureService.Reason.ACCOUNT_CLOSED);

        verify(shiftSlotRepository).decrementFilled(500L);
        verify(standbyService, never()).offerAfterNoShow(anyLong(), any());
    }

    @Test
    @DisplayName("Kapalı ilandaki vardiya boşalır ve işletmeye haber gider ama yedek çağrılmaz")
    void closedListing_noStandbyOffer() {
        JobListing l = listing(22L, ListingStatus.CLOSED);
        Application accepted = app(5L, ApplicationStatus.ACCEPTED, l, slot(500L, LocalDate.of(2026, 10, 20)));
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(List.of(accepted));

        service.releaseCandidate(CANDIDATE_ID, null, AccountClosureService.Reason.ACCOUNT_CLOSED);

        verify(shiftSlotRepository).decrementFilled(500L);
        verify(notificationService).notify(eq(OWNER_ID), any(), any(), any(), any());
        verify(standbyService, never()).offerAfterNoShow(anyLong(), any());
    }

    @Test
    @DisplayName("Eski (V25 öncesi) gelmedi kaydı: koltuklar zaten boşaltılmıştı, çift boşaltma yok")
    void legacyNoShow_untouched() {
        JobListing l = listing(22L, ListingStatus.ACTIVE);
        Application legacy = app(5L, ApplicationStatus.ACCEPTED, l, slot(500L, LocalDate.of(2026, 10, 20)));
        legacy.setNoShow(true);   // vardiya satırı yok
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(List.of(legacy));

        service.releaseCandidate(CANDIDATE_ID, null, AccountClosureService.Reason.ACCOUNT_CLOSED);

        verify(shiftSlotRepository, never()).decrementFilled(anyLong());
        assertThat(legacy.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
    }

    @Test
    @DisplayName("Gelmedi işaretli vardiyası olan başvuru: işaretli vardiya korunur, gelecekteki boşalır")
    void markedNoShowSlot_kept() {
        JobListing l = listing(22L, ListingStatus.ACTIVE);
        ShiftSlot marked = slot(400L, LocalDate.of(2026, 10, 15));
        ShiftSlot future = slot(500L, LocalDate.of(2026, 10, 20));
        Application a = app(5L, ApplicationStatus.ACCEPTED, l, marked, future);
        a.setNoShow(true);
        a.getNoShowSlots().add(ApplicationNoShowSlot.builder().application(a).shiftSlot(marked).build());
        when(applicationRepository.findAllByCandidateId(CANDIDATE_ID)).thenReturn(List.of(a));

        service.releaseCandidate(CANDIDATE_ID, NOW.plusDays(30), AccountClosureService.Reason.SUSPENDED);

        assertThat(a.getRequestedSlots()).containsExactly(marked);
        verify(shiftSlotRepository).decrementFilled(500L);
    }

    @Test
    @DisplayName("İşletme sahibi: ACTIVE ve PAUSED ilanlar ortak kapanış yolundan kapanır, CLOSED atlanır")
    void closeBusinessListings_usesCommonClosePath() {
        JobListing active = listing(1L, ListingStatus.ACTIVE);
        JobListing paused = listing(2L, ListingStatus.PAUSED);
        JobListing closed = listing(3L, ListingStatus.CLOSED);
        when(jobListingRepository.findAllByBusiness_OwnerId(OWNER_ID)).thenReturn(List.of(active, paused, closed));

        int n = service.closeBusinessListings(OWNER_ID);

        assertThat(n).isEqualTo(2);
        verify(jobListingService).closeAsModeration(active);
        verify(jobListingService).closeAsModeration(paused);
        verify(jobListingService, never()).closeAsModeration(closed);
        verify(outboxService).appendAuditLog(any());
    }

    private static ShiftSlot slotAt(long id, LocalDateTime start) {
        return ShiftSlot.builder().id(id).date(start.toLocalDate())
                .startTime(start.toLocalTime()).endTime(start.toLocalTime().plusHours(6))
                .slotsNeeded(2).slotsFilled(2).build();
    }

    @Test
    @DisplayName("Hesap kapanışı (işletme): kabul edilen adayın gelecek vardiyası iptal, koltuk iner, adaya bildirim; geçmiş vardiya korunur")
    void closeBusinessListings_cancelsAcceptedFutureShifts() {
        JobListing active = listing(1L, ListingStatus.ACTIVE);
        ShiftSlot past = slotAt(10L, NOW.minusDays(1));
        ShiftSlot future = slotAt(11L, NOW.plusDays(2).withHour(9));
        Application mixed = app(5L, ApplicationStatus.ACCEPTED, active, past, future);
        ShiftSlot onlyFuture = slotAt(12L, NOW.plusDays(3).withHour(9));
        Application allFuture = app(6L, ApplicationStatus.ACCEPTED, active, onlyFuture);
        when(jobListingRepository.findAllByBusiness_OwnerId(OWNER_ID)).thenReturn(List.of(active));
        when(applicationRepository.findAllByJobListingIdAndStatusIn(eq(1L), any()))
                .thenReturn(List.of(mixed, allFuture));

        service.closeBusinessListings(OWNER_ID);

        verify(shiftSlotRepository).decrementFilled(11L);
        verify(shiftSlotRepository).decrementFilled(12L);
        verify(shiftSlotRepository, never()).decrementFilled(10L);
        assertThat(mixed.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
        assertThat(mixed.getRequestedSlots()).containsExactly(past);
        assertThat(allFuture.getStatus()).isEqualTo(ApplicationStatus.WITHDRAWN);
        ArgumentCaptor<String> msg = ArgumentCaptor.forClass(String.class);
        verify(notificationService, org.mockito.Mockito.times(2)).notify(eq(CANDIDATE_ID),
                eq(NotificationType.LISTING_CLOSED), any(), msg.capture(), eq("applications"));
        assertThat(msg.getAllValues().get(0))
                .isEqualTo("İşletme hesabını kapattı; Garson · "
                        + future.getDate().format(java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy"))
                        + " 09:00-15:00 vardiyan iptal edildi.");
        // Yedek zinciri tetiklenmez (ilan kapanıyor)
        org.mockito.Mockito.verifyNoInteractions(standbyService);
        verify(jobListingService).closeAsModeration(active);
    }

    @Test
    @DisplayName("Ban (işletme): ACTIVE ilan PAUSED + adminSuspended, PAUSED dokunulmaz, CLOSED atlanır; kabul vardiyası iptal + audit")
    void suspendBusinessListings_pausesAndCancels() {
        JobListing active = listing(1L, ListingStatus.ACTIVE);
        JobListing paused = listing(2L, ListingStatus.PAUSED);
        JobListing closed = listing(3L, ListingStatus.CLOSED);
        ShiftSlot future = slotAt(21L, NOW.plusDays(1).withHour(9));
        Application acc = app(7L, ApplicationStatus.ACCEPTED, paused, future);
        when(jobListingRepository.findAllByBusiness_OwnerId(OWNER_ID)).thenReturn(List.of(active, paused, closed));
        when(applicationRepository.findAllByJobListingIdAndStatusIn(eq(2L), any())).thenReturn(List.of(acc));
        when(applicationRepository.findAllByJobListingIdAndStatusIn(eq(1L), any())).thenReturn(List.of());

        int n = service.suspendBusinessListings(OWNER_ID);

        assertThat(n).isEqualTo(1);
        assertThat(active.getStatus()).isEqualTo(ListingStatus.PAUSED);
        assertThat(active.isAdminSuspended()).isTrue();
        assertThat(paused.getStatus()).isEqualTo(ListingStatus.PAUSED);
        assertThat(closed.getStatus()).isEqualTo(ListingStatus.CLOSED);
        assertThat(closed.isAdminSuspended()).isFalse();
        verify(applicationRepository, never()).findAllByJobListingIdAndStatusIn(eq(3L), any());
        verify(shiftSlotRepository).decrementFilled(21L);
        assertThat(acc.getStatus()).isEqualTo(ApplicationStatus.WITHDRAWN);
        ArgumentCaptor<String> msg = ArgumentCaptor.forClass(String.class);
        verify(notificationService).notify(eq(CANDIDATE_ID), eq(NotificationType.LISTING_CLOSED),
                any(), msg.capture(), eq("applications"));
        assertThat(msg.getValue()).startsWith("İşletme askıya alındı; Garson · ").endsWith("vardiyan iptal edildi.");
        verify(jobListingService, never()).closeAsModeration(any());
        verify(outboxService).appendAuditLog(any());
    }
}
