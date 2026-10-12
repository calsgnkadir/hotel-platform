package com.hotelapp.service;

import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.ShiftSlotRepository;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Slot koltuk sayacı — tüm kabul/boşaltma akışlarının ortak kuralı.
 *
 * <p>Artırma koşullu atomik UPDATE ile yapılır; slotlar id sırasıyla işlenir
 * (eşzamanlı çok slotlu kabullerde kilit sırası tutarlı kalsın). Biri dolarsa
 * {@link BusinessRuleException} fırlar ve çağıranın transaction'ı tamamen geri
 * alınır — önceki slotlara yapılan artırmalar da.
 */
final class SlotSeats {

    private SlotSeats() {}

    static List<ShiftSlot> byId(Collection<ShiftSlot> slots) {
        if (slots == null) return List.of();
        return slots.stream().filter(Objects::nonNull)
                .sorted(Comparator.comparing(ShiftSlot::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    /** Hepsi ya da hiçbiri: dolu slot varsa 422 (transaction geri alınır). */
    static void claimAll(ShiftSlotRepository repo, Collection<ShiftSlot> slots) {
        for (ShiftSlot slot : byId(slots)) {
            if (!tryClaim(repo, slot)) {
                throw full(slot);
            }
        }
    }

    static boolean tryClaim(ShiftSlotRepository repo, ShiftSlot slot) {
        return repo.incrementFilledIfAvailable(slot.getId()) == 1;
    }

    static void release(ShiftSlotRepository repo, ShiftSlot slot) {
        repo.decrementFilled(slot.getId());
    }

    static BusinessRuleException full(ShiftSlot slot) {
        return new BusinessRuleException("Bu vardiya doldu: " + label(slot)
                + ". Sayfayı yenileyip güncel durumu kontrol et.");
    }

    static String label(ShiftSlot s) {
        return s.getDate() + " " + s.getStartTime() + "-" + s.getEndTime();
    }
}
