package com.hotelapp.service;

import com.hotelapp.entity.ShiftSlot;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Collection;
import java.util.Objects;
import java.util.Optional;

/**
 * Vardiya zaman penceresi — tüm saat hesaplarının tek kaynağı.
 *
 * <p>Gece vardiyası kuralı: bitiş saati başlangıçtan önce ya da ona eşitse vardiya
 * ertesi gün biter (22:00–06:00 → D 22:00 … D+1 06:00). Şema değişmez; slotun
 * {@code date} alanı daima BAŞLANGIÇ günüdür. İlan oluştururken eşit saat
 * ({@code end == start}) ayrıca reddedilir (bkz. {@link #validate}).
 */
public final class ShiftWindow {

    private ShiftWindow() {}

    /** Bir vardiya en fazla bu kadar sürebilir (gündüz ya da gece). */
    public static final Duration MAX_DURATION = Duration.ofHours(16);

    /** No-show ancak vardiya başladıktan bu kadar sonra işaretlenebilir. */
    public static final Duration NO_SHOW_GRACE = Duration.ofMinutes(30);

    public static LocalDateTime startAt(LocalDate date, LocalTime start) {
        return date.atTime(start);
    }

    public static LocalDateTime endAt(LocalDate date, LocalTime start, LocalTime end) {
        LocalDateTime e = date.atTime(end);
        return end.isAfter(start) ? e : e.plusDays(1);
    }

    public static LocalDateTime startAt(ShiftSlot slot) {
        return startAt(slot.getDate(), slot.getStartTime());
    }

    public static LocalDateTime endAt(ShiftSlot slot) {
        return endAt(slot.getDate(), slot.getStartTime(), slot.getEndTime());
    }

    /** Bitişi ertesi güne taşan vardiya mı? */
    public static boolean isOvernight(LocalTime start, LocalTime end) {
        return !end.isAfter(start);
    }

    public static boolean isOvernight(ShiftSlot slot) {
        return isOvernight(slot.getStartTime(), slot.getEndTime());
    }

    public static Duration duration(LocalTime start, LocalTime end) {
        LocalDate any = LocalDate.of(2000, 1, 1);
        return Duration.between(startAt(any, start), endAt(any, start, end));
    }

    public static Duration duration(ShiftSlot slot) {
        return duration(slot.getStartTime(), slot.getEndTime());
    }

    public static boolean hasStarted(ShiftSlot slot, LocalDateTime now) {
        return !now.isBefore(startAt(slot));
    }

    public static boolean hasEnded(ShiftSlot slot, LocalDateTime now) {
        return !now.isBefore(endAt(slot));
    }

    /** Vardiya başlangıcı + tolerans geçti mi (no-show işaretlenebilir mi)? */
    public static boolean noShowAllowed(ShiftSlot slot, LocalDateTime now) {
        return !now.isBefore(startAt(slot).plus(NO_SHOW_GRACE));
    }

    /** Slot zaman alanları dolu mu (eski/eksik kayıtlar hesaba girmesin). */
    public static boolean hasTimes(ShiftSlot slot) {
        return slot != null && slot.getDate() != null
                && slot.getStartTime() != null && slot.getEndTime() != null;
    }

    /** Slotların en geç bitişi — ör. "ilan son vardiyadan sonra kapanır" kuralı için. */
    public static Optional<LocalDateTime> lastEnd(Collection<ShiftSlot> slots) {
        if (slots == null) return Optional.empty();
        return slots.stream().filter(Objects::nonNull).filter(ShiftWindow::hasTimes)
                .map(ShiftWindow::endAt).max(LocalDateTime::compareTo);
    }

    /**
     * Saat kuralı: başlangıç ve bitiş eşit olamaz; süre en fazla {@link #MAX_DURATION}.
     * Hata durumunda Türkçe mesaj, geçerliyse null döner.
     */
    public static String validate(LocalTime start, LocalTime end) {
        if (end.equals(start)) {
            return "bitiş saati başlangıç saatiyle aynı olamaz";
        }
        if (duration(start, end).compareTo(MAX_DURATION) > 0) {
            return "vardiya en fazla " + MAX_DURATION.toHours() + " saat sürebilir";
        }
        return null;
    }
}
