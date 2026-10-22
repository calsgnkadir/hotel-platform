package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.ApplicationNoShowSlot;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.entity.JobListing;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.ApplicationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AcceptanceGuardTest {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 3);

    private static ShiftSlot slot(long id, LocalDate date, int sh, int eh) {
        return ShiftSlot.builder().id(id).date(date)
                .startTime(LocalTime.of(sh, 0)).endTime(LocalTime.of(eh, 0)).slotsNeeded(1).slotsFilled(0).build();
    }

    private static Application app(long id, ApplicationStatus status, ShiftSlot... slots) {
        return Application.builder().id(id).status(status).candidate(User.builder().id(7L).build())
                .requestedSlots(new HashSet<>(Set.of(slots))).build();
    }

    @Test
    @DisplayName("Çakışma: gece vardiyası ertesi güne taşar; bitişik saatler çakışmaz")
    void overlaps_respectsOvernight() {
        ShiftSlot night = slot(1L, DAY, 22, 6);
        assertThat(AcceptanceGuard.overlaps(night, slot(2L, DAY.plusDays(1), 5, 9))).isTrue();
        assertThat(AcceptanceGuard.overlaps(night, slot(3L, DAY, 18, 23))).isTrue();
        assertThat(AcceptanceGuard.overlaps(night, slot(4L, DAY.plusDays(1), 6, 14))).isFalse();
        assertThat(AcceptanceGuard.overlaps(night, slot(5L, DAY, 14, 22))).isFalse();
    }

    @Test
    @DisplayName("Gelmedi işaretli ya da bitmiş vardiya çakışma sayılmaz")
    void markedOrEndedShifts_ignored() {
        ShiftSlot marked = slot(10L, DAY.plusDays(1), 8, 16);
        Application other = app(2L, ApplicationStatus.ACCEPTED, marked);
        other.setNoShow(true);
        other.getNoShowSlots().add(ApplicationNoShowSlot.builder().application(other).shiftSlot(marked).build());
        ShiftSlot ended = slot(11L, DAY.minusDays(1), 8, 16);
        Application old = app(3L, ApplicationStatus.ACCEPTED, ended);
        ApplicationRepository repo = mock(ApplicationRepository.class);
        when(repo.findAllByCandidateIdAndStatus(7L, ApplicationStatus.ACCEPTED)).thenReturn(List.of(other, old));

        Application mine = app(1L, ApplicationStatus.REVIEWING, slot(20L, DAY.plusDays(1), 9, 17));
        assertThatCode(() -> AcceptanceGuard.requireNoOverlap(mine, repo, DAY.atTime(6, 0)))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("İşletmenin duraklattığı ilanda kabul serbest; kapalı ya da askıdaki ilanda 422")
    void pausedAllowed_closedOrSuspendedRejected() {
        JobListing listing = JobListing.builder().status(ListingStatus.PAUSED).build();
        assertThatCode(() -> AcceptanceGuard.requireListingOpen(listing, DAY.atTime(6, 0)))
                .doesNotThrowAnyException();

        listing.setStatus(ListingStatus.CLOSED);
        assertThatThrownBy(() -> AcceptanceGuard.requireListingOpen(listing, DAY.atTime(6, 0)))
                .isInstanceOf(BusinessRuleException.class);

        listing.setStatus(ListingStatus.PAUSED);
        listing.setAdminSuspended(true);
        assertThatThrownBy(() -> AcceptanceGuard.requireListingOpen(listing, DAY.atTime(6, 0)))
                .isInstanceOf(BusinessRuleException.class);
    }
}
