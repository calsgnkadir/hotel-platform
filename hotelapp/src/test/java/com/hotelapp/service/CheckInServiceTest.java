package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.entity.WorkSession;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.WorkSessionRepository;
import com.hotelapp.service.RosterService.RosterRow;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CheckInServiceTest {

    @Mock private JobListingRepository jobListingRepository;
    @Mock private BusinessRepository businessRepository;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private WorkSessionRepository workSessionRepository;
    @Mock private RosterService rosterService;
    @InjectMocks private CheckInService service;

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 3);
    private static final Long OWNER = 7L, BIZ = 3L;

    private Business business;
    private JobListing listing;
    private ShiftSlot todaySlot;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "secret", "test-secret-at-least-32-characters-long");
        ReflectionTestUtils.setField(service, "baseUrl", "https://kadrom.me/");
        service.clock = Clock.fixed(TODAY.atTime(7, 50).atZone(TR).toInstant(), TR);

        business = Business.builder().id(BIZ).name("Grand Otel").owner(User.builder().id(OWNER).build()).build();
        listing = JobListing.builder().id(10L).title("Banket").business(business).meetingPoint("B kapısı").build();
        todaySlot = ShiftSlot.builder().date(TODAY).startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        lenient().when(workSessionRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(any())).thenReturn(List.of());
        lenient().when(workSessionRepository.findByApplicationCandidateIdAndClockOutAtIsNull(any())).thenReturn(List.of());
    }

    private Application accepted(long id, String name, String phone, ShiftSlot... slots) {
        return Application.builder().id(id).status(ApplicationStatus.ACCEPTED).jobListing(listing)
                .candidate(User.builder().id(100 + id).fullName(name).phone(phone).build())
                .requestedSlots(new HashSet<>(Set.of(slots))).build();
    }

    private void team(Application... apps) {
        when(applicationRepository.findAllByJobListing_Business_IdAndStatus(BIZ, ApplicationStatus.ACCEPTED))
                .thenReturn(List.of(apps));
    }

    @Test
    void business_qr_is_permanent_and_tamper_proof() {
        String t = service.tokenFor(BIZ);
        assertThat(service.parse(t)).isEqualTo(BIZ);
        assertThat(service.tokenFor(BIZ)).isEqualTo(t);   // her gün aynı — bir kez basılıp asılır

        String other = service.tokenFor(4L);
        String forged = other.split("\\.")[0] + "." + t.split("\\.")[1];
        assertThatThrownBy(() -> service.parse(forged)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> service.parse("garbage")).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void logged_in_candidate_checks_in_to_todays_shift() {
        team(accepted(1, "Ayşe Demir", "05551000001", todaySlot));

        CheckInService.CheckInResult r = service.checkIn(service.tokenFor(BIZ), 101L);

        assertThat(r.getShift()).isEqualTo("08:00 – 16:00");
        assertThat(r.getClockInAt()).isEqualTo(TODAY.atTime(7, 50));
        assertThat(r.isAlreadyCheckedIn()).isFalse();
    }

    @Test
    void candidate_without_shift_today_is_rejected() {
        ShiftSlot tomorrow = ShiftSlot.builder().date(TODAY.plusDays(1))
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        team(accepted(1, "Ayşe Demir", "05551000001", tomorrow));

        assertThatThrownBy(() -> service.checkIn(service.tokenFor(BIZ), 101L))
                .isInstanceOf(BusinessRuleException.class);
        verify(workSessionRepository, never()).save(any());
    }

    @Test
    void overnight_shift_from_yesterday_still_counts_after_midnight() {
        ShiftSlot night = ShiftSlot.builder().date(TODAY.minusDays(1))
                .startTime(LocalTime.of(22, 0)).endTime(LocalTime.of(6, 0)).build();
        ShiftSlot yesterdayDay = ShiftSlot.builder().date(TODAY.minusDays(1))
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        team(accepted(1, "Gece Ekip", "05551000001", night),
             accepted(2, "Dun Gunduz", "05551000002", yesterdayDay));

        assertThat(service.checkInByName(service.tokenFor(BIZ), "Gece Ekip", null).getShift())
                .isEqualTo("22:00 – 06:00");
        assertThatThrownBy(() -> service.checkInByName(service.tokenFor(BIZ), "Dun Gunduz", null))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void name_checkin_ignores_case_spaces_and_turkish_letters() {
        team(accepted(1, "Ayşe Işık", "05551000001", todaySlot));

        CheckInService.CheckInResult r = service.checkInByName(service.tokenFor(BIZ), "  ayse   ISIK ", null);

        assertThat(r.isNeedPhone()).isFalse();
        assertThat(r.getFullName()).isEqualTo("Ayşe Işık");
        verify(workSessionRepository).save(any());
    }

    @Test
    void name_not_on_todays_list_is_rejected() {
        team(accepted(1, "Ayşe Demir", "05551000001", todaySlot));

        assertThatThrownBy(() -> service.checkInByName(service.tokenFor(BIZ), "Mehmet Kaya", null))
                .isInstanceOf(BusinessRuleException.class);
        verify(workSessionRepository, never()).save(any());
    }

    @Test
    void same_name_twice_asks_for_phone_last4() {
        team(accepted(1, "Ali Yılmaz", "0555 100 00 11", todaySlot),
             accepted(2, "Ali Yılmaz", "0555 100 00 22", todaySlot));
        String t = service.tokenFor(BIZ);

        assertThat(service.checkInByName(t, "Ali Yılmaz", null).isNeedPhone()).isTrue();
        verify(workSessionRepository, never()).save(any());

        CheckInService.CheckInResult r = service.checkInByName(t, "Ali Yılmaz", "0022");
        assertThat(r.getApplicationId()).isEqualTo(2L);

        assertThatThrownBy(() -> service.checkInByName(t, "Ali Yılmaz", "9999"))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void second_scan_same_day_is_idempotent() {
        Application a = accepted(1, "Ayşe Demir", "05551000001", todaySlot);
        team(a);
        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of(
                WorkSession.builder().clockInAt(TODAY.atTime(7, 40)).build()));

        CheckInService.CheckInResult r = service.checkInByName(service.tokenFor(BIZ), "Ayşe Demir", null);

        assertThat(r.isAlreadyCheckedIn()).isTrue();
        assertThat(r.getClockInAt()).isEqualTo(TODAY.atTime(7, 40));
        verify(workSessionRepository, never()).save(any());
    }

    @Test
    void manual_checkin_only_by_listing_owner() {
        Application a = accepted(1, "Ayşe Demir", "05551000001", todaySlot);
        when(applicationRepository.findById(1L)).thenReturn(Optional.of(a));

        assertThatThrownBy(() -> service.manualCheckIn(1L, 999L)).isInstanceOf(UnauthorizedException.class);

        service.manualCheckIn(1L, OWNER);
        verify(workSessionRepository).save(any());
    }

    @Test
    void attendance_counts_arrivals_and_shows_business_qr() {
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing));
        when(rosterService.collectRows(listing, TODAY)).thenReturn(Map.of(TODAY, List.of(
                new RosterRow(1L, "Ayşe", "", "08:00 – 16:00", "07:50", "", "İşte"),
                new RosterRow(2L, "Mert", "", "08:00 – 16:00", "", "", "Bekleniyor"))));

        CheckInService.AttendanceDto a = service.attendance(10L, OWNER, null);

        assertThat(a.getExpected()).isEqualTo(2);
        assertThat(a.getArrived()).isEqualTo(1);
        assertThat(a.getCheckinUrl()).isEqualTo("https://kadrom.me/checkin/" + service.tokenFor(BIZ));
    }

    @Test
    void normalize_handles_turkish() {
        assertThat(CheckInService.normalize("  İSMAİL   Çağrı ")).isEqualTo("ismail cagri");
        assertThat(CheckInService.normalize("ŞÜKRÜ Öztürk")).isEqualTo("sukru ozturk");
    }
}
