package com.hotelapp.service;

import com.hotelapp.enums.ListingStatus;
import com.hotelapp.repository.JobListingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ListingAutoCloseSchedulerTest {

    @Mock private JobListingRepository jobListingRepository;
    @Mock private JobListingService jobListingService;

    @InjectMocks private ListingAutoCloseScheduler scheduler;

    private final LocalDateTime now = LocalDateTime.of(2026, 10, 24, 9, 0);

    @Test
    void oneListingFailing_doesNotBlockOthers() {
        when(jobListingRepository.findAutoCloseCandidateIds(
                EnumSet.of(ListingStatus.ACTIVE, ListingStatus.PAUSED), LocalDate.of(2026, 10, 24)))
                .thenReturn(List.of(1L, 2L, 3L));
        when(jobListingService.autoCloseIfEnded(1L, now)).thenReturn(true);
        when(jobListingService.autoCloseIfEnded(2L, now)).thenThrow(new IllegalStateException("kilit"));
        when(jobListingService.autoCloseIfEnded(3L, now)).thenReturn(true);

        assertThat(scheduler.closeEndedListings(now)).isEqualTo(2);
        verify(jobListingService).autoCloseIfEnded(3L, now);
    }

    @Test
    void notYetEnded_isNotCounted() {
        when(jobListingRepository.findAutoCloseCandidateIds(
                EnumSet.of(ListingStatus.ACTIVE, ListingStatus.PAUSED), LocalDate.of(2026, 10, 24)))
                .thenReturn(List.of(5L));
        when(jobListingService.autoCloseIfEnded(5L, now)).thenReturn(false);

        assertThat(scheduler.closeEndedListings(now)).isZero();
    }

    @Test
    void run_usesIstanbulClock() {
        ZoneId tr = ZoneId.of("Europe/Istanbul");
        scheduler.clock = Clock.fixed(now.atZone(tr).toInstant(), tr);
        when(jobListingRepository.findAutoCloseCandidateIds(
                EnumSet.of(ListingStatus.ACTIVE, ListingStatus.PAUSED), LocalDate.of(2026, 10, 24)))
                .thenReturn(List.of(5L));

        scheduler.run();
        verify(jobListingService).autoCloseIfEnded(5L, now);
    }

    @Test
    void run_swallowsQueryFailure() {
        scheduler.clock = Clock.fixed(Instant.parse("2026-10-24T06:00:00Z"), ZoneId.of("Europe/Istanbul"));
        when(jobListingRepository.findAutoCloseCandidateIds(org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any())).thenThrow(new RuntimeException("db"));
        scheduler.run();   // istisna fırlatmaz
    }
}
