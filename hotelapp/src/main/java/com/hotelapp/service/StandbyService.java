package com.hotelapp.service;

import com.hotelapp.dto.ApplicationResponse;
import com.hotelapp.entity.Application;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.ShiftSlotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * FAZ C.1 — Yedek (standby) aday sistemi.
 *
 * <p>Isletmenin ajanstan bekledigi "gelmezse yerine adam" guvencesinin karsiligi:
 * <ol>
 *   <li>Isletme bir basvuruyu STANDBY'a alir (yedek).</li>
 *   <li>Asil aday no-show isaretlenirse slot bosalir ve sistem <b>otomatik</b>
 *       olarak siradaki yedege acil teklif gonderir (in-app + WS + web push).</li>
 *   <li>Yedek {@value #OFFER_WINDOW_HOURS} saat icinde kabul ederse ACCEPTED olur,
 *       slot yeniden dolar. Reddeder ya da suresi gecerse sıradaki yedege gecilir.</li>
 * </ol>
 *
 * <p>Teklif penceresi kisa tutulur: vardiya bugun/yarin oldugu icin saatler onemli.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StandbyService {

    /** Yedegin acil teklife cevap verme suresi (saat). */
    public static final int OFFER_WINDOW_HOURS = 3;

    private final ApplicationRepository applicationRepository;
    private final ShiftSlotRepository shiftSlotRepository;
    private final NotificationService notificationService;
    private final OutboxService outboxService;
    private final ApplicationMapper applicationMapper;

    // ================================================================
    // BUSINESS OWNER — yedek isaretle / geri al
    // ================================================================

    /**
     * Basvuruyu yedek (STANDBY) olarak isaretler.
     * Sadece henuz sonuclanmamis (PENDING/REVIEWING/HELD) basvurular yedek olabilir.
     */
    @Transactional
    public ApplicationResponse markAsStandby(Long applicationId, Long ownerId) {
        Application app = getForOwner(applicationId, ownerId);

        ApplicationStatus current = app.getStatus();
        if (current == ApplicationStatus.STANDBY) {
            throw new BusinessRuleException("Bu aday zaten yedek listesinde.");
        }
        if (current != ApplicationStatus.PENDING
                && current != ApplicationStatus.REVIEWING
                && current != ApplicationStatus.HELD) {
            throw new BusinessRuleException(
                    "Sadece sonuçlanmamış başvurular yedek olarak işaretlenebilir. Mevcut durum: " + current);
        }

        long existing = applicationRepository.countByJobListingIdAndStatus(
                app.getJobListing().getId(), ApplicationStatus.STANDBY);

        app.setStatus(ApplicationStatus.STANDBY);
        app.setStandbyRank((int) existing + 1);
        app.setHoldDeadline(null);          // HOLD'dan geldiyse sayaci temizle
        app.setStandbyOfferedAt(null);
        app.setStandbyDeadline(null);
        applicationRepository.save(app);

        outboxService.appendAuditLog(AuditLoggedEvent.user(
                ownerId, "MARK_STANDBY", "APPLICATION", applicationId,
                "İlan: " + app.getJobListing().getTitle()
                        + " · Aday: " + app.getCandidate().getEmail()
                        + " · Yedek sırası: " + app.getStandbyRank()
                        + " · Önceki durum: " + current));

        notificationService.notify(app.getCandidate().getId(),
                NotificationType.STANDBY_ASSIGNED,
                "Yedek listesine alındın",
                app.getJobListing().getTitle() + " için " + app.getStandbyRank()
                        + ". yedeksin. Asıl aday gelmezse sana anında haber vereceğiz.",
                "applications");

        return applicationMapper.toResponse(app);
    }

    /** Yedeklikten cikarir, basvuru yeniden degerlendirmeye (REVIEWING) doner. */
    @Transactional
    public ApplicationResponse removeStandby(Long applicationId, Long ownerId) {
        Application app = getForOwner(applicationId, ownerId);

        if (app.getStatus() != ApplicationStatus.STANDBY) {
            throw new BusinessRuleException("Bu başvuru yedek listesinde değil.");
        }

        app.setStatus(ApplicationStatus.REVIEWING);
        app.setStandbyRank(null);
        app.setStandbyOfferedAt(null);
        app.setStandbyDeadline(null);
        app.setStandbyReplacesApplicationId(null);
        applicationRepository.save(app);

        outboxService.appendAuditLog(AuditLoggedEvent.user(
                ownerId, "REMOVE_STANDBY", "APPLICATION", applicationId,
                "İlan: " + app.getJobListing().getTitle()
                        + " · Aday: " + app.getCandidate().getEmail()));

        return applicationMapper.toResponse(app);
    }

    // ================================================================
    // OTOMATIK — no-show sonrasi siradaki yedege teklif
    // ================================================================

    /**
     * No-show isaretlenen basvurunun yerine siradaki yedege acil teklif gonderir.
     * NoShowEventListener tarafindan AFTER_COMMIT + async cagrilir.
     *
     * @return teklif gonderilen basvuru id'si, yedek yoksa null
     */
    @Transactional
    public Long offerAfterNoShow(Long noShowApplicationId) {
        Application noShowApp = applicationRepository.findById(noShowApplicationId).orElse(null);
        if (noShowApp == null) return null;

        Long listingId = noShowApp.getJobListing().getId();

        // Vardiya tamamen gecmisse yedek cagirmanin anlami yok.
        if (!hasUpcomingSlot(noShowApp)) {
            log.info("[STANDBY] app={} vardiyasi gecmis, yedek teklifi atlandi", noShowApplicationId);
            return null;
        }

        List<Application> standbys = applicationRepository.findAvailableStandbys(listingId);
        if (standbys.isEmpty()) {
            log.info("[STANDBY] listing={} icin musait yedek yok", listingId);
            // Isletmeye bilgi: yedek yok, acik kapanmadi
            notificationService.notify(
                    noShowApp.getJobListing().getBusiness().getOwner().getId(),
                    NotificationType.STANDBY_DECLINED,
                    "Yedek aday yok",
                    noShowApp.getJobListing().getTitle()
                            + " için no-show sonrası çağrılabilecek yedek aday bulunmuyor.",
                    "applications");
            return null;
        }

        Application next = standbys.get(0);
        LocalDateTime now = LocalDateTime.now();
        next.setStandbyOfferedAt(now);
        next.setStandbyDeadline(now.plusHours(OFFER_WINDOW_HOURS));
        next.setStandbyReplacesApplicationId(noShowApplicationId);
        applicationRepository.save(next);

        outboxService.appendAuditLog(AuditLoggedEvent.system(
                "STANDBY_OFFERED", "APPLICATION", next.getId(),
                "No-show app=" + noShowApplicationId + " yerine yedek "
                        + next.getCandidate().getEmail() + " cagrildi. Son: " + next.getStandbyDeadline()));

        notificationService.notify(next.getCandidate().getId(),
                NotificationType.STANDBY_ACTIVATED,
                "Acil: sıra sende",
                next.getJobListing().getTitle() + " için asıl aday gelmedi. "
                        + OFFER_WINDOW_HOURS + " saat içinde cevap ver — kabul edersen iş senin.",
                "applications");

        log.info("[STANDBY] listing={} icin yedek app={} cagrildi", listingId, next.getId());
        return next.getId();
    }

    // ================================================================
    // CANDIDATE — acil teklife cevap
    // ================================================================

    /** Yedek aday acil teklifi kabul/ret eder. */
    @Transactional
    public ApplicationResponse respondToOffer(Long applicationId, Long candidateId, boolean accept) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));

        if (!app.getCandidate().getId().equals(candidateId)) {
            throw UnauthorizedException.keyed("error.application.notOwner");
        }
        if (app.getStatus() != ApplicationStatus.STANDBY || app.getStandbyOfferedAt() == null) {
            throw new BusinessRuleException("Bu başvuru için aktif bir yedek teklifi yok.");
        }
        if (app.getStandbyDeadline() != null && LocalDateTime.now().isAfter(app.getStandbyDeadline())) {
            expireOffer(app, "Aday süresinde cevap vermedi");
            throw new BusinessRuleException("Yedek teklifinin süresi doldu.");
        }

        Long ownerId = app.getJobListing().getBusiness().getOwner().getId();
        String listingTitle = app.getJobListing().getTitle();

        if (accept) {
            // Slot kapasitesini yeniden doldur
            if (app.getRequestedSlots() != null) {
                for (ShiftSlot slot : app.getRequestedSlots()) {
                    if (slot.isFull()) {
                        throw new BusinessRuleException(
                                "Bu vardiya bu arada doldu: " + slot.getDate() + " "
                                        + slot.getStartTime() + "-" + slot.getEndTime());
                    }
                    slot.setSlotsFilled(slot.getSlotsFilled() + 1);
                    shiftSlotRepository.save(slot);
                }
            }
            app.setStatus(ApplicationStatus.ACCEPTED);
            app.setStandbyDeadline(null);
            applicationRepository.save(app);

            outboxService.appendAuditLog(AuditLoggedEvent.user(
                    candidateId, "STANDBY_ACCEPTED", "APPLICATION", applicationId,
                    "İlan: " + listingTitle + " · Yedek aday açığı kapattı."));

            notificationService.notify(ownerId, NotificationType.STANDBY_FILLED,
                    "Yedek aday açığı kapattı",
                    app.getCandidate().getFullName() + " · " + listingTitle
                            + " vardiyasını kabul etti.",
                    "applications");
        } else {
            // Reddetti — yedeklikten cikar, siradakine gec
            app.setStatus(ApplicationStatus.WITHDRAWN);
            app.setStandbyDeadline(null);
            applicationRepository.save(app);

            outboxService.appendAuditLog(AuditLoggedEvent.user(
                    candidateId, "STANDBY_REJECTED", "APPLICATION", applicationId,
                    "İlan: " + listingTitle + " · Yedek aday teklifi reddetti."));

            notificationService.notify(ownerId, NotificationType.STANDBY_DECLINED,
                    "Yedek aday teklifi reddetti",
                    app.getCandidate().getFullName() + " · " + listingTitle
                            + " için gelemeyeceğini bildirdi. Sıradaki yedek çağrılıyor.",
                    "applications");

            cascadeToNextStandby(app);
        }

        return applicationMapper.toResponse(app);
    }

    // ================================================================
    // SCHEDULER — suresi gecen teklifler
    // ================================================================

    /**
     * Suresi gecmis yedek tekliflerini kapatir ve siradaki yedege gecer.
     * ExpiredApplicationScheduler her 5 dakikada cagirir.
     */
    @Transactional
    public int expireOverdueOffers() {
        List<Application> overdue = applicationRepository
                .findByStatusAndStandbyDeadlineBefore(ApplicationStatus.STANDBY, LocalDateTime.now());
        if (overdue.isEmpty()) return 0;

        for (Application app : overdue) {
            expireOffer(app, "Teklif süresi doldu");
            cascadeToNextStandby(app);
        }
        return overdue.size();
    }

    // ================================================================
    // Internal
    // ================================================================

    /** Teklifi suresi dolmus say: aday yedeklikten cikar, iki tarafa bildir. */
    private void expireOffer(Application app, String reason) {
        app.setStatus(ApplicationStatus.EXPIRED);
        app.setStandbyDeadline(null);
        applicationRepository.save(app);

        outboxService.appendAuditLog(AuditLoggedEvent.system(
                "STANDBY_OFFER_EXPIRED", "APPLICATION", app.getId(), reason));

        notificationService.notify(app.getCandidate().getId(),
                NotificationType.STANDBY_OFFER_EXPIRED,
                "Yedek teklifinin süresi doldu",
                app.getJobListing().getTitle() + " için verilen süre içinde cevap gelmedi.",
                "applications");

        notificationService.notify(app.getJobListing().getBusiness().getOwner().getId(),
                NotificationType.STANDBY_DECLINED,
                "Yedek adaydan cevap gelmedi",
                app.getCandidate().getFullName() + " · " + app.getJobListing().getTitle()
                        + " teklifine süresinde cevap vermedi.",
                "applications");
    }

    /** Reddedilen/suresi gecen teklifin yerine siradaki yedegi cagirir. */
    private void cascadeToNextStandby(Application declined) {
        Long replaces = declined.getStandbyReplacesApplicationId();
        if (replaces == null) return;
        offerAfterNoShow(replaces);
    }

    /** Basvurunun vardiyalarindan en az biri henuz gecmemis mi? */
    private boolean hasUpcomingSlot(Application app) {
        if (app.getRequestedSlots() == null || app.getRequestedSlots().isEmpty()) {
            return true;   // slotsuz eski akis — engellemeyelim
        }
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        return app.getRequestedSlots().stream().anyMatch(s ->
                s.getDate().isAfter(today)
                        || (s.getDate().isEqual(today)
                            && LocalDateTime.of(s.getDate(), s.getEndTime()).isAfter(now)));
    }

    private Application getForOwner(Long applicationId, Long ownerId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));
        if (!app.getJobListing().getBusiness().getOwner().getId().equals(ownerId)) {
            throw UnauthorizedException.keyed("error.application.notOwner");
        }
        return app;
    }
}
