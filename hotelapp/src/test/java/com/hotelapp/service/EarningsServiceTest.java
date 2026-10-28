package com.hotelapp.service;

import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.enums.SalaryType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FAZ 13 — EarningsService hesaplama fonksiyonlari (pure, static).
 *
 * avgRate + computeGross + plannedHours — Spring context'e gerek yok.
 */
class EarningsServiceTest {

    @Nested
    class ActualShiftHours {
        private final java.time.LocalDate day = java.time.LocalDate.of(2030, 1, 2);
        private final java.time.ZoneId zone = java.time.ZoneId.of("Europe/Istanbul");
        private ShiftSlot slot(long id, int start, int end) {
            return ShiftSlot.builder().id(id).date(day).startTime(LocalTime.of(start, 0)).endTime(LocalTime.of(end, 0)).build();
        }
        private com.hotelapp.entity.WorkSession session(Long slotId, java.time.LocalDateTime in, java.time.LocalDateTime out) {
            return com.hotelapp.entity.WorkSession.builder().shiftSlotId(slotId).clockInAt(in).clockOutAt(out).build();
        }
        private com.hotelapp.dto.EarningsResponse earnings(java.util.List<ShiftSlot> slots, com.hotelapp.entity.WorkSession... records) {
            var apps = org.mockito.Mockito.mock(com.hotelapp.repository.ApplicationRepository.class);
            var sessions = org.mockito.Mockito.mock(com.hotelapp.repository.WorkSessionRepository.class);
            var listing = com.hotelapp.entity.JobListing.builder().id(10L).title("Pilot")
                    .salaryType(SalaryType.HOURLY).salaryMin(new BigDecimal("100"))
                    .business(com.hotelapp.entity.Business.builder().id(3L).name("Test Kafe").build()).build();
            var app = com.hotelapp.entity.Application.builder().id(5L).status(com.hotelapp.enums.ApplicationStatus.ACCEPTED)
                    .jobListing(listing).requestedSlots(new java.util.HashSet<>(slots)).build();
            org.mockito.Mockito.when(apps.findAllByCandidateId(7L)).thenReturn(java.util.List.of(app));
            org.mockito.Mockito.when(sessions.findByApplicationIdOrderByClockInAtDesc(5L)).thenReturn(java.util.List.of(records));
            var service = new EarningsService(apps, sessions);
            service.clock = java.time.Clock.fixed(day.plusDays(2).atStartOfDay(zone).toInstant(), zone);
            return service.getMyEarnings(7L);
        }
        @Test void shorterRealSessionReplacesEightPlannedHours() {
            var response = earnings(java.util.List.of(slot(1, 9, 17)), session(1L, day.atTime(10, 0), day.atTime(16, 0)));
            assertThat(response.getTotalHours()).isEqualTo(6);
            assertThat(response.getTotalGross()).isEqualByComparingTo("600");
            assertThat(response.getEntries().get(0).getHoursSource()).isEqualTo("CLOCKED");
            assertThat(response.getEntries().get(0).getDurationMinutes()).isEqualTo(360L);
        }
        @Test void multipleShiftsOnSameDateUseTheirOwnSessions() {
            var response = earnings(java.util.List.of(slot(1, 0, 8), slot(2, 10, 18)),
                    session(1L, day.atTime(0, 0), day.atTime(6, 0)), session(2L, day.atTime(10, 0), day.atTime(12, 0)));
            assertThat(response.getTotalHours()).isEqualTo(8);
            assertThat(response.getEntries()).extracting(e -> e.getHours()).containsExactlyInAnyOrder(6.0, 2.0);
        }
        @Test void legacyNightSessionStartingAfterMidnightBelongsToPreviousDayShift() {
            var response = earnings(java.util.List.of(slot(1, 22, 6)),
                    session(null, day.plusDays(1).atTime(0, 0), day.plusDays(1).atTime(5, 0)));
            assertThat(response.getTotalHours()).isEqualTo(5);
            assertThat(response.getEntries().get(0).getShiftSlotId()).isEqualTo(1L);
            assertThat(response.getEntries().get(0).getHoursSource()).isEqualTo("CLOCKED");
        }
        @Test void legacySameDaySessionsAreNotCountedForBothShifts() {
            var response = earnings(java.util.List.of(slot(1, 0, 8), slot(2, 10, 18)),
                    session(null, day.atTime(0, 0), day.atTime(6, 0)),
                    session(null, day.atTime(10, 0), day.atTime(12, 0)));
            assertThat(response.getTotalHours()).isEqualTo(8);
            assertThat(response.getEntries()).extracting(e -> e.getHours()).containsExactlyInAnyOrder(6.0, 2.0);
            assertThat(response.getEntries()).extracting(e -> e.getHoursSource()).containsOnly("CLOCKED");
        }
        @Test void zeroLengthClosedSessionDoesNotBecomeEightPlannedHours() {
            var response = earnings(java.util.List.of(slot(1, 9, 17)), session(1L, day.atTime(9, 0), day.atTime(9, 0)));
            assertThat(response.getTotalHours()).isZero();
            assertThat(response.getTotalGross()).isEqualByComparingTo("0");
            assertThat(response.getEntries().get(0).getHoursSource()).isEqualTo("CLOCKED");
            assertThat(response.getEntries().get(0).getDurationMinutes()).isZero();
        }
        @Test void openSessionIsIncompleteInsteadOfPlannedOrPaid() {
            var response = earnings(java.util.List.of(slot(1, 9, 17)), session(1L, day.atTime(9, 0), null));
            assertThat(response.getTotalHours()).isZero();
            assertThat(response.getShiftCount()).isZero();
            assertThat(response.getTotalGross()).isEqualByComparingTo("0");
            assertThat(response.getEntries().get(0).getHoursSource()).isEqualTo("INCOMPLETE");
            assertThat(response.getEntries().get(0).getDurationMinutes()).isNull();
            assertThat(response.getEntries().get(0).getGross()).isNull();
        }
        @Test void invalidNegativeSessionIsIncompleteInsteadOfPlanned() {
            var response = earnings(java.util.List.of(slot(1, 9, 17)), session(1L, day.atTime(10, 0), day.atTime(9, 0)));
            assertThat(response.getTotalHours()).isZero();
            assertThat(response.getEntries().get(0).getHoursSource()).isEqualTo("INCOMPLETE");
        }
        @Test void missingSessionKeepsExplicitPlannedFallback() {
            var response = earnings(java.util.List.of(slot(1, 9, 17)));
            assertThat(response.getTotalHours()).isEqualTo(8);
            assertThat(response.getEntries().get(0).getHoursSource()).isEqualTo("PLANNED");
            assertThat(response.getEntries().get(0).getDurationMinutes()).isEqualTo(480L);
        }
    }

    @Nested @DisplayName("avgRate")
    class AvgRate {
        @Test void bothPresent_average() {
            assertThat(EarningsService.avgRate(new BigDecimal("100"), new BigDecimal("200")))
                    .isEqualByComparingTo("150.0000");
        }
        @Test void onlyMin_returnsMin() {
            assertThat(EarningsService.avgRate(new BigDecimal("120"), null))
                    .isEqualByComparingTo("120");
        }
        @Test void onlyMax_returnsMax() {
            assertThat(EarningsService.avgRate(null, new BigDecimal("90")))
                    .isEqualByComparingTo("90");
        }
        @Test void bothNull_returnsNull() {
            assertThat(EarningsService.avgRate(null, null)).isNull();
        }
    }

    @Nested @DisplayName("computeGross")
    class ComputeGross {
        @Test @DisplayName("HOURLY: saat x rate")
        void hourly() {
            var g = EarningsService.computeGross(8.0, SalaryType.HOURLY, new BigDecimal("50"));
            assertThat(g).isEqualByComparingTo("400.00");
        }
        @Test @DisplayName("DAILY: rate (saatten bagimsiz)")
        void daily() {
            var g = EarningsService.computeGross(6.5, SalaryType.DAILY, new BigDecimal("900"));
            assertThat(g).isEqualByComparingTo("900.00");
        }
        @Test @DisplayName("MONTHLY: (rate/176) x saat")
        void monthly() {
            // 17600 / 176 = 100/saat; 8 saat = 800
            var g = EarningsService.computeGross(8.0, SalaryType.MONTHLY, new BigDecimal("17600"));
            assertThat(g).isEqualByComparingTo("800.00");
        }
        @Test @DisplayName("NEGOTIABLE: null (hesaplanamaz)")
        void negotiable() {
            assertThat(EarningsService.computeGross(8.0, SalaryType.NEGOTIABLE, new BigDecimal("50"))).isNull();
        }
        @Test @DisplayName("rate null: null")
        void nullRate() {
            assertThat(EarningsService.computeGross(8.0, SalaryType.HOURLY, null)).isNull();
        }
        @Test @DisplayName("type null: null")
        void nullType() {
            assertThat(EarningsService.computeGross(8.0, null, new BigDecimal("50"))).isNull();
        }
    }

    @Nested @DisplayName("plannedHours")
    class PlannedHours {
        private ShiftSlot slot(LocalTime start, LocalTime end) {
            ShiftSlot s = new ShiftSlot();
            s.setStartTime(start);
            s.setEndTime(end);
            return s;
        }
        @Test void eightHourShift() {
            assertThat(EarningsService.plannedHours(slot(LocalTime.of(9, 0), LocalTime.of(17, 0)))).isEqualTo(8.0);
        }
        @Test void halfHour() {
            assertThat(EarningsService.plannedHours(slot(LocalTime.of(9, 0), LocalTime.of(9, 30)))).isEqualTo(0.5);
        }
        @Test void nullTimes_zero() {
            assertThat(EarningsService.plannedHours(slot(null, null))).isEqualTo(0.0);
        }
        // Eskiden 0 donuyordu; bitis < baslangic artik gece vardiyasi (ertesi gun biter).
        @Test void overnight_countsUntilNextMorning() {
            assertThat(EarningsService.plannedHours(slot(LocalTime.of(17, 0), LocalTime.of(9, 0)))).isEqualTo(16.0);
            assertThat(EarningsService.plannedHours(slot(LocalTime.of(22, 0), LocalTime.of(6, 0)))).isEqualTo(8.0);
        }
    }

    @Nested @DisplayName("getMyEarnings — vardiya bazında gelmedi (V25)")
    class NoShowPerShift {

        private ShiftSlot day(long id, int daysAgo) {
            return ShiftSlot.builder().id(id).date(java.time.LocalDate.now().minusDays(daysAgo))
                    .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
        }

        @Test
        @DisplayName("QA regresyonu: 3 günlük başvuruda 3. gün gelmedi → ilk iki günün kazancı kalır (1600 TL)")
        void noShow_keepsEarningsOfEarlierShifts() {
            var apps = org.mockito.Mockito.mock(com.hotelapp.repository.ApplicationRepository.class);
            var sessions = org.mockito.Mockito.mock(com.hotelapp.repository.WorkSessionRepository.class);
            ShiftSlot d1 = day(1L, 3), d2 = day(2L, 2), d3 = day(3L, 1);
            var listing = com.hotelapp.entity.JobListing.builder().id(10L).title("Banket")
                    .salaryType(SalaryType.DAILY).salaryMin(new BigDecimal("800")).salaryMax(new BigDecimal("800"))
                    .business(com.hotelapp.entity.Business.builder().id(3L).name("Grand Otel").build())
                    .build();
            var app = com.hotelapp.entity.Application.builder().id(5L)
                    .status(com.hotelapp.enums.ApplicationStatus.ACCEPTED).noShow(true)
                    .jobListing(listing)
                    .requestedSlots(new java.util.HashSet<>(java.util.Set.of(d1, d2, d3))).build();
            app.getNoShowSlots().add(com.hotelapp.entity.ApplicationNoShowSlot.builder()
                    .application(app).shiftSlot(d3).build());
            org.mockito.Mockito.when(apps.findAllByCandidateId(7L)).thenReturn(java.util.List.of(app));
            org.mockito.Mockito.when(sessions.findByApplicationIdOrderByClockInAtDesc(5L)).thenReturn(java.util.List.of());

            var res = new EarningsService(apps, sessions).getMyEarnings(7L);

            assertThat(res.getTotalGross()).isEqualByComparingTo("1600.00");
            assertThat(res.getShiftCount()).isEqualTo(2);
            assertThat(res.getEntries()).extracting(e -> e.getDate())
                    .containsExactlyInAnyOrder(d1.getDate(), d2.getDate());
        }
    }

    @Nested @DisplayName("getMyEarnings — vardiya bitişi ShiftWindow'a göre (O1)")
    class EndedByShiftWindow {

        private static final java.time.ZoneId TR = java.time.ZoneId.of("Europe/Istanbul");
        private static final java.time.LocalDate DAY = java.time.LocalDate.of(2026, 10, 3);

        private EarningsService serviceWith(java.time.LocalDateTime now, ShiftSlot... slots) {
            var apps = org.mockito.Mockito.mock(com.hotelapp.repository.ApplicationRepository.class);
            var sessions = org.mockito.Mockito.mock(com.hotelapp.repository.WorkSessionRepository.class);
            var listing = com.hotelapp.entity.JobListing.builder().id(10L).title("Gece")
                    .salaryType(SalaryType.HOURLY).salaryMin(new BigDecimal("100")).salaryMax(new BigDecimal("100"))
                    .business(com.hotelapp.entity.Business.builder().id(3L).name("Grand Otel").build())
                    .build();
            var app = com.hotelapp.entity.Application.builder().id(5L)
                    .status(com.hotelapp.enums.ApplicationStatus.ACCEPTED)
                    .jobListing(listing)
                    .requestedSlots(new java.util.HashSet<>(java.util.Set.of(slots))).build();
            org.mockito.Mockito.when(apps.findAllByCandidateId(7L)).thenReturn(java.util.List.of(app));
            org.mockito.Mockito.when(sessions.findByApplicationIdOrderByClockInAtDesc(5L)).thenReturn(java.util.List.of());
            var svc = new EarningsService(apps, sessions);
            svc.clock = java.time.Clock.fixed(now.atZone(TR).toInstant(), TR);
            return svc;
        }

        private ShiftSlot slot(long id, java.time.LocalDate date, int sh, int eh) {
            return ShiftSlot.builder().id(id).date(date)
                    .startTime(LocalTime.of(sh, 0)).endTime(LocalTime.of(eh, 0)).build();
        }

        @Test
        @DisplayName("Bugün biten gündüz vardiyası bitişten sonra kazanca girer (eskiden ertesi güne kadar beklerdi)")
        void dayShiftEndedToday_counts() {
            var res = serviceWith(DAY.atTime(17, 0), slot(1L, DAY, 8, 16)).getMyEarnings(7L);
            assertThat(res.getShiftCount()).isEqualTo(1);
            assertThat(res.getTotalGross()).isEqualByComparingTo("800.00");
        }

        @Test
        @DisplayName("Dün başlayıp bu sabah 06:00'da biten gece vardiyası 05:00'te henüz sayılmaz, 07:00'de sayılır")
        void overnightCountsOnlyAfterNextMorningEnd() {
            ShiftSlot night = slot(1L, DAY, 22, 6);
            assertThat(serviceWith(DAY.plusDays(1).atTime(5, 0), night).getMyEarnings(7L).getShiftCount()).isZero();
            var res = serviceWith(DAY.plusDays(1).atTime(7, 0), night).getMyEarnings(7L);
            assertThat(res.getShiftCount()).isEqualTo(1);
            assertThat(res.getTotalHours()).isEqualTo(8.0);
        }

        @Test
        @DisplayName("Gelecek vardiya kazanca girmez")
        void futureShift_excluded() {
            assertThat(serviceWith(DAY.atTime(7, 0), slot(1L, DAY, 8, 16)).getMyEarnings(7L).getShiftCount()).isZero();
        }
    }
}
