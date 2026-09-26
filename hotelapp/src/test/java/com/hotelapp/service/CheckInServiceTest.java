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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CheckInServiceTest {

    @Mock private JobListingRepository jobListingRepository;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private WorkSessionRepository workSessionRepository;
    @Mock private RosterService rosterService;
    @InjectMocks private CheckInService service;

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 3);
    private static final Long OWNER = 7L, CAND = 101L;

    private JobListing listing;
    private Application accepted;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "secret", "test-secret-at-least-32-characters-long");
        ReflectionTestUtils.setField(service, "baseUrl", "https://kadrom.me/");
        service.clock = Clock.fixed(TODAY.atTime(7, 50).atZone(TR).toInstant(), TR);

        User owner = User.builder().id(OWNER).build();
        listing = JobListing.builder().id(10L).title("Banket")
                .business(Business.builder().name("Grand Otel").owner(owner).build())
                .meetingPoint("B kapısı").build();
        ShiftSlot slot = ShiftSlot.builder().date(TODAY)
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        accepted = Application.builder().id(1L).status(ApplicationStatus.ACCEPTED).jobListing(listing)
                .candidate(User.builder().id(CAND).fullName("Ayşe").build())
                .requestedSlots(new HashSet<>(Set.of(slot))).build();
    }

    @Test
    void token_round_trips_and_rejects_tampering() {
        String t = service.tokenFor(10L, TODAY);
        CheckInService.Parsed p = service.parse(t);
        assertThat(p.listingId()).isEqualTo(10L);
        assertThat(p.date()).isEqualTo(TODAY);

        String otherListing = service.tokenFor(11L, TODAY);
        String forged = otherListing.split("\\.")[0] + "." + t.split("\\.")[1];
        assertThatThrownBy(() -> service.parse(forged)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> service.parse("garbage")).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void accepted_candidate_checks_in_once() {
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing));
        when(applicationRepository.findAllByJobListingId(10L)).thenReturn(List.of(accepted));
        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of());
        when(workSessionRepository.findByApplicationCandidateIdAndClockOutAtIsNull(CAND)).thenReturn(List.of());
        when(workSessionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        CheckInService.CheckInResult r = service.checkIn(service.tokenFor(10L, TODAY), CAND);

        assertThat(r.isAlreadyCheckedIn()).isFalse();
        assertThat(r.getShift()).isEqualTo("08:00 – 16:00");
        assertThat(r.getMeetingPoint()).isEqualTo("B kapısı");
        assertThat(r.getClockInAt()).isEqualTo(TODAY.atTime(7, 50));
    }

    @Test
    void second_scan_same_day_is_idempotent() {
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing));
        when(applicationRepository.findAllByJobListingId(10L)).thenReturn(List.of(accepted));
        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of(
                WorkSession.builder().clockInAt(TODAY.atTime(7, 40)).build()));

        CheckInService.CheckInResult r = service.checkIn(service.tokenFor(10L, TODAY), CAND);

        assertThat(r.isAlreadyCheckedIn()).isTrue();
        assertThat(r.getClockInAt()).isEqualTo(TODAY.atTime(7, 40));
        verify(workSessionRepository, never()).save(any());
    }

    @Test
    void yesterdays_qr_is_rejected() {
        assertThatThrownBy(() -> service.checkIn(service.tokenFor(10L, TODAY.minusDays(1)), CAND))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void candidate_without_accepted_application_is_rejected() {
        accepted.setStatus(ApplicationStatus.PENDING);
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing));
        when(applicationRepository.findAllByJobListingId(10L)).thenReturn(List.of(accepted));

        assertThatThrownBy(() -> service.checkIn(service.tokenFor(10L, TODAY), CAND))
                .isInstanceOf(BusinessRuleException.class);
        verify(workSessionRepository, never()).save(any());
    }

    @Test
    void manual_checkin_only_by_listing_owner() {
        when(applicationRepository.findById(1L)).thenReturn(Optional.of(accepted));

        assertThatThrownBy(() -> service.manualCheckIn(1L, 999L)).isInstanceOf(UnauthorizedException.class);

        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of());
        service.manualCheckIn(1L, OWNER);
        verify(workSessionRepository).save(any());
    }

    @Test
    void lead_link_and_qr_token_are_not_interchangeable() {
        String qr = service.tokenFor(10L, TODAY);
        String lead = service.leadTokenFor(10L, TODAY);
        assertThat(service.parseLead(lead).listingId()).isEqualTo(10L);
        assertThatThrownBy(() -> service.parseLead(qr)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> service.parse(lead)).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void lead_sees_attendance_without_lead_url_and_expired_link_fails() {
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing));
        when(rosterService.collectRows(listing, TODAY)).thenReturn(Map.of(TODAY, List.of()));

        CheckInService.AttendanceDto a = service.attendanceForLead(service.leadTokenFor(10L, TODAY));
        assertThat(a.getLeadUrl()).isNull();   // ekip başı yeni link üretemez
        assertThat(a.getCheckinUrl()).contains("/checkin/");

        assertThatThrownBy(() -> service.attendanceForLead(service.leadTokenFor(10L, TODAY.minusDays(1))))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void lead_can_mark_only_this_listings_candidates() {
        when(applicationRepository.findById(1L)).thenReturn(Optional.of(accepted));
        when(workSessionRepository.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of());

        service.manualCheckInByLead(service.leadTokenFor(10L, TODAY), 1L);
        verify(workSessionRepository).save(any());

        assertThatThrownBy(() -> service.manualCheckInByLead(service.leadTokenFor(11L, TODAY), 1L))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void attendance_counts_arrivals_and_builds_checkin_url() {
        when(jobListingRepository.findById(10L)).thenReturn(Optional.of(listing));
        when(rosterService.collectRows(listing, TODAY)).thenReturn(Map.of(TODAY, List.of(
                new RosterRow(1L, "Ayşe", "", "08:00 – 16:00", "07:50", "", "İşte"),
                new RosterRow(2L, "Mert", "", "08:00 – 16:00", "", "", "Bekleniyor"))));

        CheckInService.AttendanceDto a = service.attendance(10L, OWNER, null);

        assertThat(a.getExpected()).isEqualTo(2);
        assertThat(a.getArrived()).isEqualTo(1);
        assertThat(a.getCheckinUrl()).startsWith("https://kadrom.me/checkin/");
        assertThat(service.parse(a.getCheckinUrl().substring("https://kadrom.me/checkin/".length())).listingId())
                .isEqualTo(10L);
    }
}
