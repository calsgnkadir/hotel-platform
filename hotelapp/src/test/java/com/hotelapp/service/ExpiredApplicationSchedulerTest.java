package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.repository.ApplicationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.time.*;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Gece süre dolumu: bir kaydın @Version çakışması diğer kayıtları geri almaz. */
@ExtendWith(MockitoExtension.class)
class ExpiredApplicationSchedulerTest {

    @Mock ApplicationRepository applicationRepository;
    @Mock StandbyService standbyService;
    @Mock SgkReminderService sgkReminderService;
    @InjectMocks ExpiredApplicationScheduler scheduler;

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDateTime NOW = LocalDateTime.of(2026, 10, 3, 2, 0);

    private static Application pending(long id) {
        return Application.builder().id(id).status(ApplicationStatus.PENDING).deadline(NOW.minusHours(1)).build();
    }

    @Test
    void optimisticLockOnOneRecord_othersStillExpire() {
        scheduler.clock = Clock.fixed(NOW.atZone(TR).toInstant(), TR);
        Application a = pending(1L), b = pending(2L), c = pending(3L);
        when(applicationRepository.findExpiredApplications(NOW)).thenReturn(List.of(a, b, c));
        when(applicationRepository.findById(1L)).thenReturn(Optional.of(a));
        when(applicationRepository.findById(2L)).thenReturn(Optional.of(b));
        when(applicationRepository.findById(3L)).thenReturn(Optional.of(c));
        when(applicationRepository.saveAndFlush(any())).thenAnswer(inv -> {
            Application x = inv.getArgument(0);
            if (x.getId() == 2L) throw new ObjectOptimisticLockingFailureException(Application.class, 2L);
            return x;
        });

        scheduler.markExpiredApplications();

        assertThat(a.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
        assertThat(c.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
        verify(applicationRepository).saveAndFlush(a);
        verify(applicationRepository).saveAndFlush(c);
        verify(applicationRepository, never()).saveAll(any());
    }

    @Test
    void recordChangedMeanwhile_isNotTouched() {
        scheduler.clock = Clock.fixed(NOW.atZone(TR).toInstant(), TR);
        Application stale = pending(1L);
        Application fresh = Application.builder().id(1L).status(ApplicationStatus.ACCEPTED)
                .deadline(NOW.minusHours(1)).build();
        when(applicationRepository.findExpiredApplications(NOW)).thenReturn(List.of(stale));
        when(applicationRepository.findById(1L)).thenReturn(Optional.of(fresh));

        scheduler.markExpiredApplications();

        assertThat(fresh.getStatus()).isEqualTo(ApplicationStatus.ACCEPTED);
        verify(applicationRepository, never()).saveAndFlush(any());
    }

    @Test
    void overdueHolds_failureIsolatedPerRecord() {
        scheduler.clock = Clock.fixed(NOW.atZone(TR).toInstant(), TR);
        Application h1 = Application.builder().id(5L).status(ApplicationStatus.HELD).holdDeadline(NOW.minusMinutes(5)).build();
        Application h2 = Application.builder().id(6L).status(ApplicationStatus.HELD).holdDeadline(NOW.minusMinutes(5)).build();
        when(applicationRepository.findByStatusAndHoldDeadlineBefore(ApplicationStatus.HELD, NOW)).thenReturn(List.of(h1, h2));
        when(applicationRepository.findById(5L)).thenThrow(new IllegalStateException("db"));
        when(applicationRepository.findById(6L)).thenReturn(Optional.of(h2));
        when(applicationRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        scheduler.expireOverdueHolds();

        assertThat(h2.getStatus()).isEqualTo(ApplicationStatus.EXPIRED);
        verify(applicationRepository).saveAndFlush(h2);
    }
}
