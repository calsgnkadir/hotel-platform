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
}
