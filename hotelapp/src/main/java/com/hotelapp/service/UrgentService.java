package com.hotelapp.service;

import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * FAZ C.2 — "Hemen müsait" modu + acil ilan akışı.
 *
 * <p>Otelin ajansı arama sebebi #1: "bugün/yarın adam lazım". Bu akış onun
 * platform içindeki karşılığı:
 * <ol>
 *   <li>Aday "bugün müsaitim" der → {@code availableUntil} gün sonuna kurulur.</li>
 *   <li>İşletme bir ilanı ACİL işaretler → o an müsait olan ve pozisyonu tutan
 *       adaylara anında bildirim + web push gider.</li>
 *   <li>İkisi de kendiliğinden söner: müsaitlik gün sonunda, acillik
 *       {@code urgentUntil}'de. Kimsenin "kapatmayı unutması" sistemi bozmaz.</li>
 * </ol>
 *
 * <p><b>Neden zaman kutulu:</b> kalıcı bir "müsaitim" bayrağı acil vardiya
 * doldurmak için işe yaramaz — 3 hafta önce işaretlenmiş kayıt, otele bugün
 * kimin gelebileceğini söylemez. Havuzun değeri tazeliğinden gelir.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UrgentService {

    /** Acil ilan bildiriminde tek seferde ulaşılacak azami aday (spam/gürültü freni). */
    private static final int MAX_PUSH_TARGETS = 200;

    /** Aciliyet varsayılan ömrü — vardiya tarihi yoksa bu kadar sürer. */
    private static final int DEFAULT_URGENT_HOURS = 24;

    private final UserRepository userRepository;
    private final JobListingRepository jobListingRepository;
    private final NotificationService notificationService;
    private final OutboxService outboxService;

    // ================================================================
    // CANDIDATE — "hemen müsait" havuzu
    // ================================================================

    /**
     * Adayı "bugün müsait" havuzuna alır. Müsaitlik BUGÜNÜN sonunda biter;
     * aday her gün yeniden işaretler. Bu kasıtlı bir sürtünme: havuzun
     * değeri tazeliğinden geliyor, "bir kere aç unut" havuzu çöpe döner.
     */
    @Transactional
    public AvailabilityStatus goAvailableToday(Long candidateId) {
        User u = candidate(candidateId);
        LocalDateTime until = LocalDate.now().atTime(LocalTime.MAX);   // bugün 23:59:59.999
        u.setAvailableUntil(until);
        userRepository.save(u);

        outboxService.appendAuditLog(AuditLoggedEvent.user(
                candidateId, "AVAILABLE_NOW_ON", "USER", candidateId,
                "Hemen müsait: " + until));

        log.info("[URGENT] candidate={} hemen musait, bitis={}", candidateId, until);
        return statusOf(u);
    }

    /** Adayı havuzdan çıkarır. */
    @Transactional
    public AvailabilityStatus goUnavailable(Long candidateId) {
        User u = candidate(candidateId);
        u.setAvailableUntil(null);
        userRepository.save(u);

        outboxService.appendAuditLog(AuditLoggedEvent.user(
                candidateId, "AVAILABLE_NOW_OFF", "USER", candidateId, "Hemen müsait kapatıldı"));
        return statusOf(u);
    }

    @Transactional(readOnly = true)
    public AvailabilityStatus getAvailability(Long candidateId) {
        return statusOf(candidate(candidateId));
    }

    /** İşletme tarafında gösterilen havuz büyüklüğü. */
    @Transactional(readOnly = true)
    public long availableNowCount() {
        return userRepository.countAvailableNowCandidates(LocalDateTime.now());
    }

    // ================================================================
    // BUSINESS — acil ilan
    // ================================================================

    /**
     * İlanı acil işaretler / acilliğini kaldırır.
     * Acile alındığında "hemen müsait" havuzuna bildirim gider.
     *
     * @return bildirim gönderilen aday sayısı (kaldırma işleminde 0)
     */
    @Transactional
    public UrgentResult setUrgent(Long listingId, Long ownerId, boolean urgent) {
        JobListing listing = listingForOwner(listingId, ownerId);

        if (!urgent) {
            listing.setUrgent(false);
            listing.setUrgentUntil(null);
            jobListingRepository.save(listing);
            outboxService.appendAuditLog(AuditLoggedEvent.user(
                    ownerId, "LISTING_URGENT_OFF", "JOB_LISTING", listingId, listing.getTitle()));
            return UrgentResult.builder().urgent(false).notifiedCount(0).build();
        }

        if (listing.getStatus() != ListingStatus.ACTIVE) {
            throw new BusinessRuleException(
                    "Sadece aktif ilanlar acil işaretlenebilir. Mevcut durum: " + listing.getStatus());
        }
        if (listing.isUrgentNow()) {
            throw new BusinessRuleException("Bu ilan zaten acil olarak işaretli.");
        }

        LocalDateTime until = computeUrgentUntil(listing);
        if (until.isBefore(LocalDateTime.now())) {
            throw new BusinessRuleException(
                    "İlanın vardiyaları geçmiş; acil işaretlemenin bir karşılığı yok.");
        }

        listing.setUrgent(true);
        listing.setUrgentUntil(until);
        jobListingRepository.save(listing);

        outboxService.appendAuditLog(AuditLoggedEvent.user(
                ownerId, "LISTING_URGENT_ON", "JOB_LISTING", listingId,
                listing.getTitle() + " · bitiş: " + until));

        int notified = pushToAvailablePool(listing);
        return UrgentResult.builder().urgent(true).urgentUntil(until).notifiedCount(notified).build();
    }

    /**
     * Acil ilanı "hemen müsait" havuzuna duyurur.
     *
     * <p>Bildirim hatası ana işlemi bozmaz: ilan acil kalır, sadece duyuru
     * eksik gider. İşletmenin acil işaretlemesi bildirim altyapısına bağlı olmamalı.
     */
    private int pushToAvailablePool(JobListing listing) {
        try {
            List<User> pool = userRepository.findAvailableNowCandidates(
                    LocalDateTime.now(), listing.getPosition());
            if (pool.isEmpty()) {
                log.info("[URGENT] listing={} icin musait aday yok", listing.getId());
                return 0;
            }

            List<User> targets = pool.size() > MAX_PUSH_TARGETS
                    ? pool.subList(0, MAX_PUSH_TARGETS) : pool;

            String business = listing.getBusiness().getName();
            String when = nearestSlotLabel(listing);
            String message = business + (when != null ? " · " + when : "")
                    + " — hemen müsait olduğun için sana önce haber veriyoruz.";

            int sent = 0;
            for (User u : targets) {
                try {
                    notificationService.notify(u.getId(), NotificationType.URGENT_LISTING,
                            "Acil: " + listing.getTitle(), message, "/listings/" + listing.getId());
                    sent++;
                } catch (Exception ex) {
                    log.warn("[URGENT] bildirim basarisiz user={}: {}", u.getId(), ex.getMessage());
                }
            }
            log.info("[URGENT] listing={} icin {}/{} adaya bildirim gonderildi",
                    listing.getId(), sent, pool.size());
            return sent;
        } catch (Exception ex) {
            log.warn("[URGENT] havuz push'u basarisiz listing={}: {}", listing.getId(), ex.getMessage());
            return 0;
        }
    }

    // ================================================================
    // Internal
    // ================================================================

    /**
     * Aciliyet bitişi: en yakın vardiyanın bitişi; vardiya yoksa +24 saat.
     * Vardiya geçtikten sonra "acil" etiketi anlamsız — rozet enflasyonunu
     * engellemek için kendiliğinden söner.
     */
    private LocalDateTime computeUrgentUntil(JobListing listing) {
        LocalDateTime now = LocalDateTime.now();
        return (listing.getShiftSlots() == null ? List.<ShiftSlot>of() : listing.getShiftSlots())
                .stream()
                .filter(s -> s.getDate() != null && s.getEndTime() != null)
                .map(s -> LocalDateTime.of(s.getDate(), s.getEndTime()))
                .filter(dt -> dt.isAfter(now))
                .min(LocalDateTime::compareTo)
                .orElse(now.plusHours(DEFAULT_URGENT_HOURS));
    }

    /** "bugün 16:00" / "yarın 08:00" / "5 Haz 08:00" — bildirim metni için. */
    private String nearestSlotLabel(JobListing listing) {
        if (listing.getShiftSlots() == null) return null;
        LocalDate today = LocalDate.now();
        return listing.getShiftSlots().stream()
                .filter(s -> s.getDate() != null && !s.getDate().isBefore(today))
                .min((a, b) -> {
                    int c = a.getDate().compareTo(b.getDate());
                    return c != 0 ? c : a.getStartTime().compareTo(b.getStartTime());
                })
                .map(s -> {
                    String day = s.getDate().isEqual(today) ? "bugün"
                            : s.getDate().isEqual(today.plusDays(1)) ? "yarın"
                            : s.getDate().getDayOfMonth() + "." + s.getDate().getMonthValue();
                    return s.getStartTime() != null
                            ? day + " " + s.getStartTime().toString().substring(0, 5)
                            : day;
                })
                .orElse(null);
    }

    private AvailabilityStatus statusOf(User u) {
        return AvailabilityStatus.builder()
                .availableNow(u.isAvailableNow())
                .availableUntil(u.isAvailableNow() ? u.getAvailableUntil() : null)
                .build();
    }

    private User candidate(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Aday", id));
    }

    private JobListing listingForOwner(Long listingId, Long ownerId) {
        JobListing l = jobListingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("İlan", listingId));
        if (!l.getBusiness().getOwner().getId().equals(ownerId)) {
            throw UnauthorizedException.keyed("error.listing.notOwner");
        }
        return l;
    }

    // ================================================================
    // DTOs
    // ================================================================

    @Data @Builder
    public static class AvailabilityStatus {
        private boolean availableNow;
        private LocalDateTime availableUntil;
    }

    @Data @Builder
    public static class UrgentResult {
        private boolean urgent;
        private LocalDateTime urgentUntil;
        private int notifiedCount;
    }
}
