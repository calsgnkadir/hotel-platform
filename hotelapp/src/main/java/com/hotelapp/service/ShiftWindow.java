package com.hotelapp.service;

import com.hotelapp.entity.ShiftSlot;

import java.time.DayOfWeek;
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

    /** Bir vardiya en fazla bu kadar sürebilir (gündüz ya da gece). Müsaitlik blokları için {@link #MAX_BLOCK_DURATION}. */
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

    // ── Haftalık müsaitlik bloğu (aday profili) ─────────────────────────
    // Aynı gece kuralı: bitiş <= başlangıç → blok ertesi gün biter (Pzt 22:00–06:00
    // = Pzt 22:00 … Sal 06:00). Hafta sonundan başa sarma (Paz 22:00–Pzt 06:00) desteklenir.

    private static final long WEEK_MINUTES = 7L * 24 * 60;

    /** Haftanın başından (Pazartesi 00:00) dakika. */
    private static long weekMinute(DayOfWeek day, LocalTime t) {
        return (day.getValue() - 1) * 24L * 60 + t.getHour() * 60L + t.getMinute();
    }

    /** Haftalık müsaitlik bloğu (gün + saat aralığı); entity'den bağımsız. */
    public record WeeklyBlock(DayOfWeek day, LocalTime start, LocalTime end) {}

    /** Bloğun dakika cinsinden süresi. Gündüz bloğunda 23:59 bitiş gün sonu (24:00) sayılır. */
    private static long blockMinutes(LocalTime start, LocalTime end) {
        if (end.equals(LocalTime.of(23, 59)) && end.isAfter(start)) {
            return Duration.between(start, LocalTime.MAX).toMinutes() + 1;
        }
        return duration(start, end).toMinutes();
    }

    /**
     * Adayın haftalık müsaitlik blokları vardiyayı tamamen kapsıyor mu?
     * <ul>
     *   <li>Gece bloğu ertesi güne taşar: Pzt 22:00–06:00, Pzt 23:00–05:00 vardiyasını
     *       ve Sal 00:00–06:00 / Sal 04:00–06:00 vardiyasını kapsar.</li>
     *   <li>Bitişik bloklar birleşir: Pzt 18:00–23:59 + Sal 00:00–08:00, Pzt 22:00–06:00
     *       gece vardiyasını kapsar.</li>
     *   <li>Hafta başa sarar: Paz 22:00–06:00, Pzt 02:00–05:00'ı kapsar.</li>
     * </ul>
     */
    public static boolean blocksCover(Collection<WeeklyBlock> blocks, ShiftSlot slot) {
        if (blocks == null || blocks.isEmpty() || !hasTimes(slot)) return false;
        // Aralıklar [başlangıç, bitiş) hafta dakikası; sarma için +1 hafta kopyası.
        java.util.List<long[]> iv = new java.util.ArrayList<>();
        for (WeeklyBlock b : blocks) {
            if (b == null || b.day() == null || b.start() == null || b.end() == null) continue;
            long s0 = weekMinute(b.day(), b.start());
            long len = blockMinutes(b.start(), b.end());
            iv.add(new long[] { s0, s0 + len });
            iv.add(new long[] { s0 + WEEK_MINUTES, s0 + WEEK_MINUTES + len });
        }
        iv.sort(java.util.Comparator.comparingLong(a -> a[0]));
        java.util.List<long[]> merged = new java.util.ArrayList<>();
        for (long[] cur : iv) {
            long[] last = merged.isEmpty() ? null : merged.get(merged.size() - 1);
            if (last != null && cur[0] <= last[1]) {
                last[1] = Math.max(last[1], cur[1]);
            } else {
                merged.add(new long[] { cur[0], cur[1] });
            }
        }
        long sStart = weekMinute(slot.getDate().getDayOfWeek(), slot.getStartTime());
        long sLen = duration(slot).toMinutes();
        for (long ss : new long[] { sStart, sStart + WEEK_MINUTES }) {
            for (long[] m : merged) {
                if (m[0] <= ss && ss + sLen <= m[1]) return true;
            }
        }
        return false;
    }

    /**
     * Müsaitlik bloğu en fazla bu kadar sürebilir. Blok bir vardiya değildir; 16 saat
     * sınırı ({@link #MAX_DURATION}) yalnız iş vardiyaları içindir. Eşit saat zaten
     * reddedildiğinden pratikte her blok 24 saatten kısadır (ör. 00:00–23:59, 06:00–23:59).
     */
    public static final Duration MAX_BLOCK_DURATION = Duration.ofHours(24);

    /**
     * Müsaitlik bloğu saat kuralı: eşit saat olamaz; bitiş başlangıçtan önceyse gece
     * bloğu (ertesi gün biter); en fazla {@link #MAX_BLOCK_DURATION}.
     * Hata durumunda Türkçe mesaj, geçerliyse null.
     */
    public static String validateBlock(LocalTime start, LocalTime end) {
        if (end.equals(start)) {
            return "Bitiş saati başlangıç saatiyle aynı olamaz";
        }
        if (duration(start, end).compareTo(MAX_BLOCK_DURATION) > 0) {
            return "Müsaitlik aralığı en fazla " + MAX_BLOCK_DURATION.toHours() + " saat olabilir";
        }
        return null;
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
