package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.ApplicationNoShowSlot;
import com.hotelapp.entity.ShiftSlot;

import java.time.LocalDateTime;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Vardiya bazinda "gelmedi" kurali — giris, kart, kazanc ve yoklamanin ortak kaynagi.
 *
 * <p>Yalniz {@code application_no_show_slots} satiri olan vardiya gelmedi sayilir (giris
 * reddi, kart, kazanc). Eski kayit (V25 oncesi: {@code noShow=true} ama tabloda satir
 * yok) yalniz yoklamada onceki davranisla gosterilir: baslamis (+30 dk) ve girissiz
 * vardiyalar "Gelmedi"; kazanc ve giris eski kayitta degismez (onceki davranis).
 */
final class NoShowSlots {

    private NoShowSlots() {}

    /** Basvurunun gelmedi isaretli vardiya id'leri. */
    static Set<Long> ids(Application app) {
        if (app.getNoShowSlots() == null) return Set.of();
        return app.getNoShowSlots().stream()
                .map(ApplicationNoShowSlot::getShiftSlot)
                .filter(Objects::nonNull)
                .map(ShiftSlot::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
    }

    /** V25 oncesi isaretlenmis (ya da slotsuz) no-show: bayrak var, vardiya satiri yok. */
    static boolean isLegacy(Application app) {
        return app.isNoShow() && ids(app).isEmpty();
    }

    /** Bu vardiya gelmedi olarak isaretlendi mi (V25 satiri) — giris, kart, kazanc. */
    static boolean isMarked(Application app, ShiftSlot slot) {
        return slot != null && app.isNoShow() && ids(app).contains(slot.getId());
    }

    /**
     * Yoklamada "Gelmedi" gosterilsin mi? Isaretli vardiya; eski kayitta (satir yok)
     * baslamis (+30 dk) ve girisi olmayan vardiyalar (onceki davranis).
     */
    static boolean showsAsNoShow(Application app, ShiftSlot slot, boolean hasSession, LocalDateTime now) {
        if (slot == null || !app.isNoShow()) return false;   // satir varsa bayrak da true
        Set<Long> marked = ids(app);
        if (!marked.isEmpty()) return marked.contains(slot.getId());
        return !hasSession && ShiftWindow.hasTimes(slot) && ShiftWindow.noShowAllowed(slot, now);
    }
}
