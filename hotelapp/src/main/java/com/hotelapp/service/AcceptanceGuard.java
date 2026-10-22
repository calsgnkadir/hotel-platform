package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.ApplicationRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Kabul kapısı — bir başvurunun ACCEPTED olduğu tüm yolların ortak kuralı
 * (işletme kararı, adayın teklif onayı, yedeğin acil teklif kabulü).
 *
 * <ol>
 *   <li>İlan kapanmamış (CLOSED değil) ve yönetici tarafından askıya alınmamış olmalı.
 *       İşletmenin kendi duraklattığı (PAUSED) ilanda bekleyen başvurular kabul edilebilir:
 *       duraklatma yeni başvuruyu durdurur, mevcutları değerlendirmeyi değil.</li>
 *   <li>İşletme sahibinin hesabı açık ve yasaklı olmamalı.</li>
 *   <li>Başlamış vardiyalar başvurudan çıkarılır; hiç gelecek vardiya kalmazsa 422.</li>
 *   <li>Aday aynı saatlerde kabul edilmiş başka bir vardiyada olmamalı
 *       ({@link ShiftWindow}; gece vardiyası ertesi gün biter).</li>
 * </ol>
 *
 * Koltuk alma (SlotSeats) bu kontrolden SONRA yapılır; hata çağıranın transaction'ını
 * geri alır.
 */
final class AcceptanceGuard {

    private AcceptanceGuard() {}

    static final String LISTING_NOT_ACTIVE =
            "Bu ilan kapalı ya da askıda; başvuru kabul edilemez.";
    static final String OWNER_INACTIVE =
            "Bu işletmenin hesabı şu anda aktif değil; başvuru kabul edilemez.";
    static final String NO_FUTURE_SHIFT =
            "Başvurudaki vardiyaların hepsi başladı ya da geçti; başvuru kabul edilemez.";

    static void check(Application app, ApplicationRepository applicationRepository, LocalDateTime now) {
        requireListingOpen(app.getJobListing(), now);
        pruneStartedSlots(app, now);
        requireNoOverlap(app, applicationRepository, now);
    }

    static void requireListingOpen(JobListing listing, LocalDateTime now) {
        if (listing == null || listing.getStatus() == ListingStatus.CLOSED || listing.isAdminSuspended()) {
            throw new BusinessRuleException(LISTING_NOT_ACTIVE);
        }
        User owner = listing.getBusiness() != null ? listing.getBusiness().getOwner() : null;
        if (owner != null && (!owner.isEnabled()
                || (owner.getBannedUntil() != null && owner.getBannedUntil().isAfter(now)))) {
            throw new BusinessRuleException(OWNER_INACTIVE);
        }
    }

    /** Başlamış vardiyaları başvurudan çıkarır. Slotsuz eski başvuruya dokunmaz. */
    static void pruneStartedSlots(Application app, LocalDateTime now) {
        Set<ShiftSlot> slots = app.getRequestedSlots();
        if (slots == null || slots.isEmpty()) return;
        List<ShiftSlot> started = slots.stream()
                .filter(sl -> ShiftWindow.hasTimes(sl) && ShiftWindow.hasStarted(sl, now))
                .toList();
        if (started.isEmpty()) return;
        if (started.size() == slots.size()) {
            throw new BusinessRuleException(NO_FUTURE_SHIFT);
        }
        slots.removeAll(started);
    }

    /**
     * Adayın diğer ACCEPTED başvurularındaki (gelmedi işaretli olmayan, bitmemiş)
     * vardiyalarla zaman çakışması varsa 422.
     */
    static void requireNoOverlap(Application app, ApplicationRepository applicationRepository, LocalDateTime now) {
        Set<ShiftSlot> mine = app.getRequestedSlots();
        if (mine == null || mine.isEmpty() || app.getCandidate() == null) return;
        List<Application> others = applicationRepository.findAllByCandidateIdAndStatus(
                app.getCandidate().getId(), ApplicationStatus.ACCEPTED);
        if (others == null || others.isEmpty()) return;
        for (Application other : others) {
            if (other == app || (app.getId() != null && Objects.equals(other.getId(), app.getId()))) continue;
            if (other.getRequestedSlots() == null) continue;
            Set<Long> marked = NoShowSlots.ids(other);
            for (ShiftSlot theirs : other.getRequestedSlots()) {
                if (!ShiftWindow.hasTimes(theirs) || marked.contains(theirs.getId())) continue;
                if (ShiftWindow.hasEnded(theirs, now)) continue;
                for (ShiftSlot slot : mine) {
                    if (!ShiftWindow.hasTimes(slot)) continue;
                    if (overlaps(slot, theirs)) {
                        throw new BusinessRuleException(
                                "Aday aynı saatlerde kabul edilmiş başka bir vardiyada çalışıyor ("
                                + label(theirs) + "). Çakışan vardiya kabul edilemez.");
                    }
                }
            }
        }
    }

    static boolean overlaps(ShiftSlot a, ShiftSlot b) {
        return ShiftWindow.startAt(a).isBefore(ShiftWindow.endAt(b))
                && ShiftWindow.startAt(b).isBefore(ShiftWindow.endAt(a));
    }

    private static String label(ShiftSlot s) {
        java.time.format.DateTimeFormatter d = java.time.format.DateTimeFormatter.ofPattern("dd.MM.yyyy");
        return s.getDate().format(d) + " " + s.getStartTime() + "–" + s.getEndTime();
    }
}
