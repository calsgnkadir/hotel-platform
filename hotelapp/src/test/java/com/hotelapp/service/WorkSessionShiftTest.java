package com.hotelapp.service;

import com.hotelapp.entity.*;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.WorkSessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.*;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WorkSessionShiftTest {
    @Mock WorkSessionRepository sessions;
    @Mock ApplicationRepository applications;
    @InjectMocks WorkSessionService service;

    @Test
    void gps_entry_uses_same_shift_identity_and_cannot_reopen_consumed_card() {
        LocalDate day = LocalDate.of(2026, 10, 3);
        ZoneId zone = ZoneId.of("Europe/Istanbul");
        service.clock = Clock.fixed(day.atTime(8, 0).atZone(zone).toInstant(), zone);
        ShiftSlot slot = ShiftSlot.builder().id(11L).date(day)
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        Business business = Business.builder().name("Hotel").latitude(BigDecimal.ZERO).longitude(BigDecimal.ZERO).build();
        Application app = Application.builder().id(1L).candidate(User.builder().id(2L).build())
                .jobListing(JobListing.builder().business(business).title("Shift").build())
                .status(ApplicationStatus.ACCEPTED).requestedSlots(Set.of(slot)).build();
        when(applications.findByIdForCheckIn(1L)).thenReturn(Optional.of(app));
        when(sessions.findByApplicationCandidateIdAndClockOutAtIsNull(2L)).thenReturn(List.of());
        when(sessions.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of());
        service.clockIn(2L, 1L, BigDecimal.ZERO, BigDecimal.ZERO);
        verify(sessions).save(argThat(w -> Long.valueOf(11).equals(w.getShiftSlotId())));
        when(sessions.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of(
                WorkSession.builder().shiftSlotId(11L).clockInAt(day.atTime(7, 50)).clockOutAt(day.atTime(7, 55)).build()));
        assertThatThrownBy(() -> service.clockIn(2L, 1L, BigDecimal.ZERO, BigDecimal.ZERO))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("zaten kayıtlı");
        verify(sessions, times(1)).save(any());
    }

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDate DAY = LocalDate.of(2026, 10, 3);

    private Application acceptedApp(Set<ShiftSlot> slots) {
        Business business = Business.builder().name("Hotel").latitude(BigDecimal.ZERO).longitude(BigDecimal.ZERO).build();
        return Application.builder().id(1L).candidate(User.builder().id(2L).build())
                .jobListing(JobListing.builder().business(business).title("Shift").build())
                .status(ApplicationStatus.ACCEPTED).requestedSlots(new java.util.HashSet<>(slots)).build();
    }

    private void at(LocalDateTime t) {
        service.clock = Clock.fixed(t.atZone(TR).toInstant(), TR);
    }

    @Test
    void gps_entry_outside_shift_day_is_refused() {
        at(DAY.plusDays(2).atTime(9, 0));
        ShiftSlot slot = ShiftSlot.builder().id(11L).date(DAY)
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        when(applications.findByIdForCheckIn(1L)).thenReturn(Optional.of(acceptedApp(Set.of(slot))));
        when(sessions.findByApplicationCandidateIdAndClockOutAtIsNull(2L)).thenReturn(List.of());

        assertThatThrownBy(() -> service.clockIn(2L, 1L, BigDecimal.ZERO, BigDecimal.ZERO))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("devam eden bir vardiyan yok");
        verify(sessions, never()).save(any());
    }

    @Test
    void gps_entry_on_closed_or_suspended_listing_is_refused() {
        at(DAY.atTime(8, 0));
        ShiftSlot slot = ShiftSlot.builder().id(11L).date(DAY)
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        Application app = acceptedApp(Set.of(slot));
        app.getJobListing().setStatus(com.hotelapp.enums.ListingStatus.CLOSED);
        when(applications.findByIdForCheckIn(1L)).thenReturn(Optional.of(app));

        assertThatThrownBy(() -> service.clockIn(2L, 1L, BigDecimal.ZERO, BigDecimal.ZERO))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("ilan kapalı");

        app.getJobListing().setStatus(com.hotelapp.enums.ListingStatus.ACTIVE);
        app.getJobListing().setAdminSuspended(true);
        assertThatThrownBy(() -> service.clockIn(2L, 1L, BigDecimal.ZERO, BigDecimal.ZERO))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("ilan kapalı");
        verify(sessions, never()).save(any());
    }

    @Test
    void gps_entry_night_shift_after_midnight_attributes_to_shift() {
        at(DAY.plusDays(1).atTime(2, 0));   // D 22:00 – D+1 06:00 devam ediyor
        ShiftSlot night = ShiftSlot.builder().id(12L).date(DAY)
                .startTime(LocalTime.of(22, 0)).endTime(LocalTime.of(6, 0)).build();
        when(applications.findByIdForCheckIn(1L)).thenReturn(Optional.of(acceptedApp(Set.of(night))));
        when(sessions.findByApplicationCandidateIdAndClockOutAtIsNull(2L)).thenReturn(List.of());
        when(sessions.findByApplicationIdOrderByClockInAtDesc(1L)).thenReturn(List.of());

        service.clockIn(2L, 1L, BigDecimal.ZERO, BigDecimal.ZERO);

        verify(sessions).save(argThat(w -> Long.valueOf(12).equals(w.getShiftSlotId())));
    }

    @Test
    void gps_entry_legacy_slotless_application_still_allowed() {
        at(DAY.atTime(9, 0));
        when(applications.findByIdForCheckIn(1L)).thenReturn(Optional.of(acceptedApp(Set.of())));
        when(sessions.findByApplicationCandidateIdAndClockOutAtIsNull(2L)).thenReturn(List.of());

        service.clockIn(2L, 1L, BigDecimal.ZERO, BigDecimal.ZERO);

        verify(sessions).save(argThat(w -> w.getShiftSlotId() == null));
    }

    @Test
    void gps_entry_without_coordinates_is_refused() {
        ShiftSlot slot = ShiftSlot.builder().id(11L).date(DAY)
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        when(applications.findByIdForCheckIn(1L)).thenReturn(Optional.of(acceptedApp(Set.of(slot))));

        assertThatThrownBy(() -> service.clockIn(2L, 1L, null, BigDecimal.ZERO))
                .isInstanceOf(BusinessRuleException.class).hasMessageContaining("Konum");
    }

    @Test
    void geo_body_requires_coordinates_in_range() {
        var validator = jakarta.validation.Validation.buildDefaultValidatorFactory().getValidator();
        var body = new com.hotelapp.controller.WorkSessionController.GeoBody();
        assertThat(validator.validate(body)).hasSize(2);
        body.setLat(new BigDecimal("41.0"));
        body.setLng(new BigDecimal("200"));
        assertThat(validator.validate(body)).extracting(jakarta.validation.ConstraintViolation::getMessage)
                .containsExactly("Geçersiz konum");
        body.setLng(new BigDecimal("29.0"));
        assertThat(validator.validate(body)).isEmpty();
    }
}
