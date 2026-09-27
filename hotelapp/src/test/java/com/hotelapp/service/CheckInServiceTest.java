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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CheckInServiceTest {

    @Mock private JobListingRepository jobListingRepository;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private WorkSessionRepository workSessionRepository;
    @Mock private RosterService rosterService;
    @Mock private FileStorageService fileStorageService;
    @InjectMocks private CheckInService service;

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 3);
    private static final Long OWNER = 7L, CAND = 101L;

    private JobListing listing;
    private ShiftSlot todaySlot;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "secret", "test-secret-at-least-32-characters-long");
        ReflectionTestUtils.setField(service, "baseUrl", "https://kadrom.me/");
        at(7, 50);

        Business business = Business.builder().id(3L).name("Grand Otel").owner(User.builder().id(OWNER).build()).build();
        listing = JobListing.builder().id(10L).title("Banket").business(business).meetingPoint("B kapısı").build();
        todaySlot = ShiftSlot.builder().date(TODAY).startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        lenient().when(workSessionRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(any())).thenReturn(List.of());
    }

    private void at(int h, int m) {
        service.clock = Clock.fixed(TODAY.atTime(h, m).atZone(TR).toInstant(), TR);
    }

    private Application accepted(ShiftSlot... slots) {
        return Application.builder().id(1L).status(ApplicationStatus.ACCEPTED).jobListing(listing)
                .candidate(User.builder().id(CAND).fullName("Ayşe Demir").avatarPath("upload:image:a.jpg").build())
                .requestedSlots(new HashSet<>(Set.of(slots))).build();
    }

    @Test
    void pass_token_is_tamper_proof() {
        String t = service.tokenFor(1L, TODAY);
        assertThat(service.parse(t).applicationId()).isEqualTo(1L);
        String other = service.tokenFor(2L, TODAY);
        String forged = other.split("\\.")[0] + "." + t.split("\\.")[1];
        assertThatThrownBy(() -> service.parse(forged)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> service.parse("garbage")).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void candidate_gets_pass_only_for_todays_shift() {
        ShiftSlot tomorrow = ShiftSlot.builder().date(TODAY.plusDays(1))
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        when(applicationRepository.findAllByCandidateId(CAND)).thenReturn(List.of(accepted(todaySlot, tomorrow)));

        List<CheckInService.PassDto> passes = service.myPasses(CAND);

        assertThat(passes).hasSize(1);
        assertThat(passes.get(0).getShift()).isEqualTo("08:00 – 16:00");
        assertThat(passes.get(0).getPassUrl()).isEqualTo("https://kadrom.me/giris/" + service.tokenFor(1L, TODAY));
        assertThat(passes.get(0).getUsedAt()).isNull();
    }

    @Test
    void scan_records_entry_once_and_second_scan_says_already_used() {
        Application a = accepted(todaySlot);
        when(applicationRepository.findById(1L)).thenReturn(Optional.of(a));
        when(fileStorageService.publicUrl("upload:image:a.jpg")).thenReturn("https://img/a.jpg");
        String t = service.tokenFor(1L, TODAY);

        CheckInService.ScanResult first = service.scan(t, OWNER);
        assertThat(first.isAlreadyUsed()).isFalse();
        assertThat(first.getFullName()).isEqualTo("Ayşe Demir");
        assertThat(first.getPhotoUrl()).isEqualTo("https://img/a.jpg");
        assertThat(first.getClockInAt()).isEqualTo(TODAY.atTime(7, 50));

        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of(
                WorkSession.builder().clockInAt(TODAY.atTime(7, 50)).build()));
        at(8, 5);
        CheckInService.ScanResult second = service.scan(t, OWNER);

        assertThat(second.isAlreadyUsed()).isTrue();
        assertThat(second.getClockInAt()).isEqualTo(TODAY.atTime(7, 50));
        verify(workSessionRepository, times(1)).save(any());
    }

    @Test
    void other_business_cannot_scan() {
        when(applicationRepository.findById(1L)).thenReturn(Optional.of(accepted(todaySlot)));

        assertThatThrownBy(() -> service.scan(service.tokenFor(1L, TODAY), 999L))
                .isInstanceOf(UnauthorizedException.class);
        verify(workSessionRepository, never()).save(any());
    }

    @Test
    void yesterdays_pass_is_rejected_but_overnight_shift_counts_after_midnight() {
        ShiftSlot yesterdayDay = ShiftSlot.builder().date(TODAY.minusDays(1))
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        when(applicationRepository.findById(1L)).thenReturn(Optional.of(accepted(yesterdayDay)));
        assertThatThrownBy(() -> service.scan(service.tokenFor(1L, TODAY.minusDays(1)), OWNER))
                .isInstanceOf(BusinessRuleException.class);

        ShiftSlot night = ShiftSlot.builder().date(TODAY.minusDays(1))
                .startTime(LocalTime.of(22, 0)).endTime(LocalTime.of(6, 0)).build();
        when(applicationRepository.findById(1L)).thenReturn(Optional.of(accepted(night)));
        at(0, 10);
        assertThat(service.scan(service.tokenFor(1L, TODAY.minusDays(1)), OWNER).getShift())
                .isEqualTo("22:00 – 06:00");
    }

    @Test
    void withdrawn_application_pass_is_rejected() {
        Application a = accepted(todaySlot);
        a.setStatus(ApplicationStatus.WITHDRAWN);
        when(applicationRepository.findById(1L)).thenReturn(Optional.of(a));

        assertThatThrownBy(() -> service.scan(service.tokenFor(1L, TODAY), OWNER))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void manual_checkin_only_by_listing_owner() {
        when(applicationRepository.findById(1L)).thenReturn(Optional.of(accepted(todaySlot)));

        assertThatThrownBy(() -> service.manualCheckIn(1L, 999L)).isInstanceOf(UnauthorizedException.class);

        service.manualCheckIn(1L, OWNER);
        verify(workSessionRepository).save(any());
    }

    @Test
    void attendance_counts_arrivals() {
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing));
        when(rosterService.collectRows(listing, TODAY)).thenReturn(Map.of(TODAY, List.of(
                new RosterRow(1L, "Ayşe", "", "08:00 – 16:00", "07:50", "", "İşte"),
                new RosterRow(2L, "Mert", "", "08:00 – 16:00", "", "", "Bekleniyor"))));

        CheckInService.AttendanceDto a = service.attendance(10L, OWNER, null);

        assertThat(a.getExpected()).isEqualTo(2);
        assertThat(a.getArrived()).isEqualTo(1);
    }
}
