package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.WorkSession;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Comparator;
import java.util.Optional;

/** Shared shift attribution for passes, manual/GPS check-in and roster exports. */
final class ShiftAttendance {
    private ShiftAttendance() {}

    static LocalDateTime start(ShiftSlot slot) {
        return slot.getDate().atTime(slot.getStartTime());
    }

    static LocalDateTime end(ShiftSlot slot) {
        LocalDateTime end = slot.getDate().atTime(slot.getEndTime());
        return slot.getEndTime().isAfter(slot.getStartTime()) ? end : end.plusDays(1);
    }

    // Cards are available on the shift day, including early arrival, until its end.
    static boolean isCurrent(ShiftSlot slot, LocalDateTime now) {
        return !now.isBefore(slot.getDate().atStartOfDay()) && now.isBefore(end(slot));
    }

    /** Old sessions have no slot ID. Attribute each to at most one shift. */
    static Optional<ShiftSlot> inferSlot(Collection<ShiftSlot> slots, LocalDateTime at) {
        if (at == null) return Optional.empty();
        Comparator<ShiftSlot> order = Comparator.comparing(ShiftAttendance::start)
                .thenComparing(ShiftSlot::getId);
        Optional<ShiftSlot> active = slots.stream()
                .filter(s -> !at.isBefore(start(s)) && at.isBefore(end(s)))
                .max(order);
        if (active.isPresent()) return active;
        return slots.stream().filter(s -> isCurrent(s, at)).min(order);
    }

    static Optional<WorkSession> sessionFor(Application app, ShiftSlot slot, Collection<WorkSession> sessions) {
        return sessions.stream().filter(w -> w.getClockInAt() != null)
                .filter(w -> w.getShiftSlotId() != null
                        ? w.getShiftSlotId().equals(slot.getId())
                        : inferSlot(app.getRequestedSlots(), w.getClockInAt())
                            .map(s -> s.getId().equals(slot.getId())).orElse(false))
                .min(Comparator.comparing(WorkSession::getClockInAt));
    }
}
