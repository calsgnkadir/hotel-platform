package com.hotelapp.service;

import com.hotelapp.entity.*;
import com.hotelapp.enums.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.*;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Actual database regression: history's canonical ledger must not replace six hours with planned eight. */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(EarningsService.class)
class ActualHoursHistoryJpaTest {
    @Autowired EntityManager em;
    @Autowired EarningsService earnings;
    private Object originalClock;

    @AfterEach void restoreClock() {
        if (originalClock != null) ReflectionTestUtils.setField(earnings, "clock", originalClock);
    }

    @Test void persistedSixHourSessionProducesSixHoursAndSixHundredLira() {
        LocalDate day = LocalDate.of(2030, 1, 2);
        ZoneId zone = ZoneId.of("Europe/Istanbul");
        originalClock = ReflectionTestUtils.getField(earnings, "clock");
        ReflectionTestUtils.setField(earnings, "clock", Clock.fixed(day.atTime(18, 0).atZone(zone).toInstant(), zone));
        User owner = User.builder().email("history-owner@example.test").password("test-only").fullName("Test İşletmesi").role(Role.BUSINESS_OWNER).build();
        User candidate = User.builder().email("history-candidate@example.test").password("test-only").fullName("Test Aday").role(Role.CANDIDATE).build();
        em.persist(owner); em.persist(candidate);
        Business business = Business.builder().name("Test Kafe").type(BusinessType.CAFE).owner(owner).build();
        em.persist(business);
        JobListing listing = JobListing.builder().business(business).title("Sekiz saat planlanan vardiya").description("Test")
                .position(Position.WAITER).jobType(JobType.DAILY).salaryType(SalaryType.HOURLY).salaryMin(new BigDecimal("100"))
                .status(ListingStatus.ACTIVE).build();
        em.persist(listing);
        ShiftSlot slot = ShiftSlot.builder().jobListing(listing).date(day).startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(17, 0)).build();
        em.persist(slot);
        Application application = Application.builder().candidate(candidate).jobListing(listing).status(ApplicationStatus.ACCEPTED)
                .requestedSlots(new HashSet<>(Set.of(slot))).build();
        em.persist(application);
        em.persist(WorkSession.builder().application(application).shiftSlotId(slot.getId())
                .clockInAt(day.atTime(10, 0)).clockOutAt(day.atTime(16, 0)).build());
        Long candidateId = candidate.getId(), slotId = slot.getId();
        em.flush(); em.clear();

        var response = earnings.getMyEarnings(candidateId);
        assertThat(response.getTotalHours()).isEqualTo(6.0);
        assertThat(response.getTotalGross()).isEqualByComparingTo("600.00");
        assertThat(response.getEntries()).hasSize(1);
        var entry = response.getEntries().get(0);
        assertThat(entry.getShiftSlotId()).isEqualTo(slotId);
        assertThat(entry.getHoursSource()).isEqualTo("CLOCKED");
        assertThat(entry.getDurationMinutes()).isEqualTo(360L);
        assertThat(entry.getHours()).isEqualTo(6.0);
    }
}
