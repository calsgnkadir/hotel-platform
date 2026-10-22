package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.ShiftSlot;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ApplicationMapperTest {

    private Application appWithLatestSlot(LocalDate latestSlotDate) {
        Application a = new Application();
        if (latestSlotDate != null) {
            ShiftSlot earlier = new ShiftSlot();
            earlier.setDate(latestSlotDate.minusDays(5));
            ShiftSlot latest = new ShiftSlot();
            latest.setDate(latestSlotDate);
            // saatsiz eski slot: gün sonu esas alınır
            a.setRequestedSlots(new HashSet<>(List.of(earlier, latest)));
        }
        return a;
    }

    @Test
    @DisplayName("isWorkCompleted: slot tarihleri gecmiste -> true")
    void isWorkCompleted_pastSlots_true() {
        assertThat(ApplicationMapper.isWorkCompleted(appWithLatestSlot(LocalDate.now().minusDays(1)))).isTrue();
    }

    @Test
    @DisplayName("isWorkCompleted: slot bos -> true (backward compat)")
    void isWorkCompleted_emptySlots_true() {
        assertThat(ApplicationMapper.isWorkCompleted(appWithLatestSlot(null))).isTrue();
    }

    @Test
    @DisplayName("isWorkCompleted: en son slot bugun ya da ileride -> false")
    void isWorkCompleted_futureSlot_false() {
        assertThat(ApplicationMapper.isWorkCompleted(appWithLatestSlot(LocalDate.now()))).isFalse();
        assertThat(ApplicationMapper.isWorkCompleted(appWithLatestSlot(LocalDate.now().plusDays(1)))).isFalse();
    }

    private static final java.time.LocalDate DAY = java.time.LocalDate.of(2026, 10, 3);

    private Application appWith(ShiftSlot... slots) {
        Application a = new Application();
        a.setRequestedSlots(new HashSet<>(List.of(slots)));
        return a;
    }

    private ShiftSlot slot(long id, java.time.LocalDate date, int sh, int eh) {
        return ShiftSlot.builder().id(id).date(date)
                .startTime(java.time.LocalTime.of(sh, 0)).endTime(java.time.LocalTime.of(eh, 0)).build();
    }

    @Test
    @DisplayName("isWorkCompleted: bugün biten gündüz vardiyası bitiş saatinden sonra tamamlandı")
    void isWorkCompleted_dayShiftEndedToday() {
        Application a = appWith(slot(1L, DAY, 8, 16));
        assertThat(ApplicationMapper.isWorkCompleted(a, DAY.atTime(15, 59))).isFalse();
        assertThat(ApplicationMapper.isWorkCompleted(a, DAY.atTime(16, 0))).isTrue();
    }

    @Test
    @DisplayName("isWorkCompleted: gece vardiyası ertesi sabah bitince tamamlandı")
    void isWorkCompleted_overnightEndsNextDay() {
        Application a = appWith(slot(1L, DAY.minusDays(2), 8, 16), slot(2L, DAY, 22, 6));
        assertThat(ApplicationMapper.isWorkCompleted(a, DAY.plusDays(1).atTime(0, 30))).isFalse();
        assertThat(ApplicationMapper.isWorkCompleted(a, DAY.plusDays(1).atTime(5, 59))).isFalse();
        assertThat(ApplicationMapper.isWorkCompleted(a, DAY.plusDays(1).atTime(6, 0))).isTrue();
    }
}
