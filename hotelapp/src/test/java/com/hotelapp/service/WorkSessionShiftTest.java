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
}
