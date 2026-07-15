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
        @Test void endBeforeStart_zero() {
            assertThat(EarningsService.plannedHours(slot(LocalTime.of(17, 0), LocalTime.of(9, 0)))).isEqualTo(0.0);
        }
    }
}
