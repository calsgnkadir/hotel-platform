package com.hotelapp.service;

import com.hotelapp.entity.*;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.WorkSessionRepository;
import com.hotelapp.service.RosterService.RosterRow;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

/**
 * Gece vardiyası (22:00–06:00) giriş penceresi ve no-show işaretli vardiyaya
 * girişin reddi — QR (scan), elle (manualCheckIn), GPS (clockIn) ve giriş kartı.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NightShiftAndNoShowEntryTest {

    @Mock private JobListingRepository jobListingRepository;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private WorkSessionRepository workSessionRepository;
    @Mock private RosterService rosterService;
    @Mock private FileStorageService fileStorageService;

    private CheckInService checkIn;
    private WorkSessionService gps;

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDate DAY = LocalDate.of(2026, 10, 3);
    private static final Long OWNER = 7L, CAND = 101L;

    private JobListing listing;
    private ShiftSlot night;

    @BeforeEach
    void setUp() {
        checkIn = new CheckInService(jobListingRepository, applicationRepository, workSessionRepository,
                rosterService, fileStorageService);
        ReflectionTestUtils.setField(checkIn, "secret", "test-secret-at-least-32-characters-long");
        ReflectionTestUtils.setField(checkIn, "baseUrl", "https://kadrom.me");
        gps = new WorkSessionService(workSessionRepository, applicationRepository);

        Business business = Business.builder().id(3L).name("Grand Otel")
                .latitude(BigDecimal.ZERO).longitude(BigDecimal.ZERO)
                .owner(User.builder().id(OWNER).build()).build();
        night = ShiftSlot.builder().id(11L).date(DAY)
                .startTime(LocalTime.of(22, 0)).endTime(LocalTime.of(6, 0)).build();
        listing = JobListing.builder().id(10L).title("Gece resepsiyon").business(business)
                .shiftSlots(new ArrayList<>(List.of(night))).build();
        when(workSessionRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(any())).thenReturn(List.of());
        when(workSessionRepository.findByApplicationCandidateIdAndClockOutAtIsNull(CAND)).thenReturn(List.of());
    }

    private void at(LocalDateTime t) {
        Clock c = Clock.fixed(t.atZone(TR).toInstant(), TR);
        checkIn.clock = c;
        gps.clock = c;
    }

    private Application accepted(ShiftSlot... slots) {
        Application a = Application.builder().id(1L).status(ApplicationStatus.ACCEPTED).jobListing(listing)
                .candidate(User.builder().id(CAND).fullName("Ayşe Demir").build())
                .requestedSlots(new HashSet<>(Set.of(slots))).build();
        when(applicationRepository.findByIdForCheckIn(1L)).thenReturn(Optional.of(a));
        when(applicationRepository.findAllByCandidateId(CAND)).thenReturn(List.of(a));
        return a;
    }

    @Test
    @DisplayName("ShiftWindow: 22:00–06:00 ertesi gün 06:00'da biter, 8 saat")
    void shiftWindow_overnight() {
        assertThat(ShiftWindow.endAt(night)).isEqualTo(DAY.plusDays(1).atTime(6, 0));
        assertThat(ShiftWindow.duration(night)).isEqualTo(Duration.ofHours(8));
        assertThat(ShiftWindow.isOvernight(night)).isTrue();
        assertThat(ShiftWindow.hasEnded(night, DAY.plusDays(1).atTime(5, 59))).isFalse();
        assertThat(ShiftWindow.hasEnded(night, DAY.plusDays(1).atTime(6, 0))).isTrue();
        assertThat(ShiftWindow.noShowAllowed(night, DAY.atTime(22, 29))).isFalse();
        assertThat(ShiftWindow.noShowAllowed(night, DAY.atTime(22, 30))).isTrue();
        assertThat(ShiftWindow.validate(LocalTime.of(22, 0), LocalTime.of(6, 0))).isNull();
        assertThat(ShiftWindow.validate(LocalTime.of(8, 0), LocalTime.of(8, 0))).isNotNull();
        assertThat(ShiftWindow.validate(LocalTime.of(20, 0), LocalTime.of(13, 0))).contains("16 saat");
        assertThat(ShiftWindow.lastEnd(List.of(night, ShiftSlot.builder().id(12L).date(DAY)
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build())))
                .contains(DAY.plusDays(1).atTime(6, 0));
    }

    @Test
    @DisplayName("QR: 23:30'da ve ertesi gün 05:30'da giriş geçerli; 06:31'de geçersiz")
    void qr_validAcrossMidnight() {
        accepted(night);
        String token = checkIn.tokenFor(1L, 11L, DAY);

        at(DAY.atTime(23, 30));
        assertThat(checkIn.myPasses(CAND)).hasSize(1);
        assertThat(checkIn.scan(token, OWNER).getClockInAt()).isEqualTo(DAY.atTime(23, 30));

        at(DAY.plusDays(1).atTime(5, 30));
        assertThat(checkIn.myPasses(CAND)).hasSize(1);
        assertThat(checkIn.scan(token, OWNER).getClockInAt()).isEqualTo(DAY.plusDays(1).atTime(5, 30));

        at(DAY.plusDays(1).atTime(6, 31));
        assertThat(checkIn.myPasses(CAND)).isEmpty();
        assertThatThrownBy(() -> checkIn.scan(token, OWNER))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("şu anda geçerli değil");
    }

    @Test
    @DisplayName("Elle giriş ve GPS: ertesi gün 05:30'da gece vardiyasına bağlanır")
    void manualAndGps_overnight() {
        accepted(night);
        at(DAY.plusDays(1).atTime(5, 30));

        checkIn.manualCheckIn(1L, OWNER, 11L);
        gps.clockIn(CAND, 1L, BigDecimal.ZERO, BigDecimal.ZERO);

        verify(workSessionRepository, times(2)).save(argThat(w ->
                Long.valueOf(11L).equals(w.getShiftSlotId())));
    }

    @Test
    @DisplayName("No-show işaretli vardiya (V25 satırı): slot başvuruda kalır ama kart üretilmez; QR, elle ve GPS giriş reddedilir")
    void noShowSlot_entryRefused() {
        Application a = accepted(night);
        a.setNoShow(true);
        a.getNoShowSlots().add(ApplicationNoShowSlot.builder().application(a).shiftSlot(night).build());
        at(DAY.atTime(23, 0));
        String token = checkIn.tokenFor(1L, 11L, DAY);

        assertThat(checkIn.myPasses(CAND)).isEmpty();
        assertThatThrownBy(() -> checkIn.scan(token, OWNER))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("gelmedi olarak işaretlendi");
        assertThatThrownBy(() -> checkIn.manualCheckIn(1L, OWNER, 11L))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("gelmedi olarak işaretlendi");
        assertThatThrownBy(() -> gps.clockIn(CAND, 1L, BigDecimal.ZERO, BigDecimal.ZERO))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("gelmedi olarak işaretlendi");
        verify(workSessionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Aynı başvurunun işaretsiz vardiyası etkilenmez: kart çıkar, giriş kaydedilir")
    void otherSlotOfNoShowApplication_entryAllowed() {
        ShiftSlot dayBefore = ShiftSlot.builder().id(10L).date(DAY.minusDays(1))
                .startTime(LocalTime.of(22, 0)).endTime(LocalTime.of(6, 0)).build();
        Application a = accepted(dayBefore, night);
        a.setNoShow(true);
        a.getNoShowSlots().add(ApplicationNoShowSlot.builder().application(a).shiftSlot(dayBefore).build());
        at(DAY.atTime(23, 0));

        assertThat(checkIn.myPasses(CAND)).extracting(CheckInService.PassDto::getShiftSlotId).containsExactly(11L);
        checkIn.manualCheckIn(1L, OWNER, 11L);

        verify(workSessionRepository).save(argThat(w -> Long.valueOf(11L).equals(w.getShiftSlotId())));
    }

    @Test
    @DisplayName("Eski slotsuz no-show (satır yok): GPS girişi reddedilir (önceki davranış)")
    void legacySlotlessNoShow_gpsRefused() {
        Application a = accepted();
        a.setNoShow(true);
        at(DAY.atTime(23, 0));

        assertThatThrownBy(() -> gps.clockIn(CAND, 1L, BigDecimal.ZERO, BigDecimal.ZERO))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("gelmedi olarak işaretlendi");
    }

    @Test
    @DisplayName("Yoklama (bugün): dün başlayan ve süren gece vardiyası listede görünür")
    void attendance_includesOngoingOvernight() {
        at(DAY.plusDays(1).atTime(2, 0));
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing));
        RosterRow row = new RosterRow(1L, "Ayşe Demir", "", "22:00 – 06:00", "", "", "Bekleniyor", 11L, true);
        when(rosterService.collectRows(listing, DAY.plusDays(1))).thenReturn(Map.of());
        when(rosterService.collectRows(listing, DAY)).thenReturn(Map.of(DAY, List.of(row)));

        CheckInService.AttendanceDto dto = checkIn.attendance(10L, OWNER, null);

        assertThat(dto.getRows()).containsExactly(row);
        assertThat(dto.getExpected()).isEqualTo(1);

        // Vardiya bittikten sonra (06:31) artık bugünün yoklamasına taşınmaz.
        at(DAY.plusDays(1).atTime(6, 31));
        assertThat(checkIn.attendance(10L, OWNER, null).getRows()).isEmpty();
    }

    @Test
    @DisplayName("Ekip listesi: no-show başvurunun gelecek vardiyası 'Gelmedi' değil 'Bekleniyor'")
    void roster_noShowIsPerSlot() {
        RosterService roster = new RosterService(jobListingRepository, applicationRepository, workSessionRepository);
        LocalDate future = LocalDate.now().plusDays(3);
        ShiftSlot upcoming = ShiftSlot.builder().id(21L).date(future)
                .startTime(LocalTime.of(22, 0)).endTime(LocalTime.of(6, 0)).build();
        Application a = Application.builder().id(5L).status(ApplicationStatus.ACCEPTED).noShow(true)
                .candidate(User.builder().id(CAND).fullName("Ayşe Demir").build())
                .requestedSlots(new HashSet<>(Set.of(upcoming))).build();
        when(applicationRepository.findAllByJobListingId(10L)).thenReturn(List.of(a));

        List<RosterRow> rows = roster.collectRows(listing, future).get(future);

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).status()).isEqualTo("Bekleniyor");
    }
}
