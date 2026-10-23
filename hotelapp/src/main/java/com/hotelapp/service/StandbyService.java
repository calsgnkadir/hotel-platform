package com.hotelapp.service;

import com.hotelapp.dto.ApplicationResponse;
import com.hotelapp.entity.Application;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.OfferExpiredException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.CandidateBlockRepository;
import com.hotelapp.repository.ShiftSlotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * FAZ C.1 — Yedek (standby) aday sistemi.
 *
 * <p>Isletmenin ajanstan bekledigi "gelmezse yerine adam" guvencesinin karsiligi:
 * <ol>
 *   <li>Isletme bir basvuruyu STANDBY'a alir (yedek).</li>
 *   <li>Asil aday no-show isaretlenirse slot bosalir ve sistem <b>otomatik</b>
 *       olarak bosalan slotu talep etmis siradaki yedege acil teklif gonderir
 *       (in-app + WS + web push + SMS).</li>
 *   <li>Yedek {@value #OFFER_WINDOW_HOURS} saat icinde kabul ederse ACCEPTED olur,
 *       bos koltuk atomik olarak dolar. Reddeder, suresi gecer, yedeklikten cekilir
 *       ya da isletme onu cikarir/reddederse siradaki yedege gecilir.</li>
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
    private final SmsService smsService;   // yedek kanal (push'a EK) — acil aktivasyonda
    private final CandidateBlockRepository candidateBlockRepository;   // isletme adayi engeller
    private final com.hotelapp.repository.UserRepository userRepository; // kabulde aday satiri kilidi

    /** Vardiya saatleri Türkiye yerel saati (testte sabitlenebilir). */
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

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
                    "Yalnızca sonuçlanmamış başvurular yedek olarak işaretlenebilir. Başvurunun durumu: "
                    + current.label());
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

    /**
     * Yedeklikten cikarir, basvuru yeniden degerlendirmeye (REVIEWING) doner.
     * Aktif teklifi olan yedek cikarilirsa sira bir sonraki yedege gecer.
     */
    @Transactional
    public ApplicationResponse removeStandby(Long applicationId, Long ownerId) {
        Application app = getForOwner(applicationId, ownerId);

        if (app.getStatus() != ApplicationStatus.STANDBY) {
            throw new BusinessRuleException("Bu başvuru yedek listesinde değil.");
        }
        Long cascadeFor = activeOfferReplaces(app);

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

        if (cascadeFor != null) {
            offerAfterNoShow(cascadeFor);
        }
        return applicationMapper.toResponse(app);
    }

    // ================================================================
    // OTOMATIK — no-show sonrasi siradaki yedege teklif
    // ================================================================

    /**
     * Zincirin devami (yedek reddetti / suresi doldu / cekildi / cikarildi /
     * engellendi): ilanin hala bos ve bitmemis slotlari uzerinden siradaki yedegi cagirir.
     *
     * @return teklif gonderilen basvuru id'si, yedek yoksa null
     */
    @Transactional
    public Long offerAfterNoShow(Long noShowApplicationId) {
        return offerAfterNoShow(noShowApplicationId, null);
    }

    /**
     * No-show isaretlenen basvurunun yerine siradaki yedege acil teklif gonderir.
     * NoShowEventListener tarafindan AFTER_COMMIT + async cagrilir.
     *
     * <p>Eslesme bosalan slot(lar) uzerinden yapilir: yalniz requestedSlots'u bos ve
     * bitmemis bu slotlarla kesisen yedek cagrilir. {@code vacatedSlotIds} null ise
     * (zincir devami) ilanin hala bos ve bitmemis tum slotlari kullanilir.
     *
     * @return teklif gonderilen basvuru id'si, yedek yoksa null
     */
    @Transactional
    public Long offerAfterNoShow(Long noShowApplicationId, Collection<Long> vacatedSlotIds) {
        Application noShowApp = applicationRepository.findById(noShowApplicationId).orElse(null);
        if (noShowApp == null) return null;

        Long listingId = noShowApp.getJobListing().getId();
        LocalDateTime now = LocalDateTime.now(clock);

        // Kapalı ya da yönetici tarafından askıya alınmış ilanda yedek çağrılmaz:
        // teklif kabul edilemez (AcceptanceGuard), aday boşuna aranmasın. İşletmenin
        // kendi duraklattığı ilanda (PAUSED) gelmeyen adayın yerine yedek yine aranır.
        var noShowListing = noShowApp.getJobListing();
        if (noShowListing.getStatus() == com.hotelapp.enums.ListingStatus.CLOSED
                || noShowListing.isAdminSuspended()) {
            log.info("[STANDBY] listing={} kapalı/askıda, yedek teklifi atlandı", listingId);
            return null;
        }

        List<ShiftSlot> pool = vacatedSlotIds != null
                ? shiftSlotRepository.findAllById(vacatedSlotIds)
                : shiftSlotRepository.findAllByJobListingId(listingId);
        boolean slotted = (pool != null && !pool.isEmpty())
                || (noShowApp.getRequestedSlots() != null && !noShowApp.getRequestedSlots().isEmpty());
        Set<Long> vacancy = pool == null ? Set.of() : pool.stream()
                .filter(ShiftWindow::hasTimes)
                .filter(sl -> !ShiftWindow.hasEnded(sl, now))
                .filter(sl -> !sl.isFull())
                .map(ShiftSlot::getId)
                .collect(Collectors.toSet());

        // Vardiya bitmisse ya da bos koltuk kalmadiysa yedek cagirmanin anlami yok.
        if (slotted && vacancy.isEmpty()) {
            log.info("[STANDBY] app={} icin bos ve bitmemis vardiya yok, yedek teklifi atlandi", noShowApplicationId);
            return null;
        }

        List<Application> standbys = applicationRepository.findAvailableStandbys(listingId).stream()
                .filter(sb -> !slotted || matchesVacancy(sb, vacancy, now))
                .toList();
        if (standbys.isEmpty()) {
            log.info("[STANDBY] listing={} icin musait yedek yok", listingId);
            // Isletmeye bilgi: yedek yok, acik kapanmadi
            notificationService.notify(
                    noShowApp.getJobListing().getBusiness().getOwner().getId(),
                    NotificationType.STANDBY_DECLINED,
                    "Yedek aday yok",
                    noShowApp.getJobListing().getTitle()
                            + " için boşalan vardiyaya çağrılabilecek yedek aday bulunmuyor.",
                    "applications");
            return null;
        }

        Application next = standbys.get(0);
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
                next.getJobListing().getTitle() + " için bir vardiya boşaldı. "
                        + OFFER_WINDOW_HOURS + " saat içinde cevap ver — kabul edersen iş senin.",
                "applications");

        // Yedek kanal — zamana duyarli teklif, push'a EK olarak SMS (best-effort)
        smsService.send(next.getCandidate().getPhone(),
                "Kadrom acil: " + next.getJobListing().getTitle()
                        + " icin sira sende. " + OFFER_WINDOW_HOURS
                        + " saat icinde uygulamadan cevap ver.");

        log.info("[STANDBY] listing={} icin yedek app={} cagrildi", listingId, next.getId());
        return next.getId();
    }

    // ================================================================
    // CANDIDATE — acil teklife cevap
    // ================================================================

    /**
     * Yedek aday acil teklifi kabul/ret eder.
     * Suresi gecmis teklif: EXPIRED + siradaki yedege gecis KALICI olur, sonra 422.
     */
    // READ_COMMITTED: aday kilidi alindiktan sonraki cakisma sorgusu taze veriyi gorsun.
    @Transactional(noRollbackFor = OfferExpiredException.class,
            isolation = org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public ApplicationResponse respondToOffer(Long applicationId, Long candidateId, boolean accept) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));

        if (!app.getCandidate().getId().equals(candidateId)) {
            throw UnauthorizedException.keyed("error.application.notOwner");
        }
        if (app.getStatus() != ApplicationStatus.STANDBY || app.getStandbyOfferedAt() == null) {
            throw new BusinessRuleException("Bu başvuru için aktif bir yedek teklifi yok.");
        }
        if (app.getStandbyDeadline() != null && LocalDateTime.now(clock).isAfter(app.getStandbyDeadline())) {
            expireOffer(app, "Aday süresinde cevap vermedi");
            cascadeToNextStandby(app);
            throw new OfferExpiredException("Yedek teklifinin süresi doldu.");
        }

        Long ownerId = app.getJobListing().getBusiness().getOwner().getId();
        String listingTitle = app.getJobListing().getTitle();

        if (accept) {
            // Engel aninda STANDBY basvurular REJECTED olur; bu kontrol yaris durumuna karsi yedek.
            if (candidateBlockRepository.existsByBusinessIdAndCandidateId(
                    app.getJobListing().getBusiness().getId(), candidateId)) {
                throw new BusinessRuleException("Bu işletmeye başvuru yapamazsın.");
            }
            // Kabul kapısı (işletme kararı ve teklif onayıyla aynı kural).
            // Ayni adayin eszamanli kabulleri sirayla (cakisma kontrolu yarissiz).
            AcceptanceGuard.lockCandidate(app, userRepository);
            AcceptanceGuard.check(app, applicationRepository, LocalDateTime.now(clock));
            app.setStatus(ApplicationStatus.ACCEPTED);
            app.setStandbyDeadline(null);
            // Once basvuru (iyimser kilit): isletme ayni anda karar verdiyse 409.
            applicationRepository.saveAndFlush(app);
            claimOpenSeats(app);

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
     * Kayit basina transaction (REQUIRES_NEW). Spring baglaminda kurulur; baglam disi
     * birim testlerinde transaction'siz calisir (ExpiredApplicationScheduler deseni).
     */
    private org.springframework.transaction.support.TransactionOperations perRecordTx =
            org.springframework.transaction.support.TransactionOperations.withoutTransaction();

    @org.springframework.beans.factory.annotation.Autowired
    void setTransactionManager(org.springframework.transaction.PlatformTransactionManager txManager) {
        org.springframework.transaction.support.TransactionTemplate t =
                new org.springframework.transaction.support.TransactionTemplate(txManager);
        t.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.perRecordTx = t;
    }

    /**
     * Suresi gecmis yedek tekliflerini kapatir ve siradaki yedege gecer.
     * ExpiredApplicationScheduler her 5 dakikada cagirir.
     *
     * <p>Bilerek {@code @Transactional} degil. Her teklif kendi transaction'inda taze
     * okunur; arada aday cevap verdiyse/isletme cikardiysa dokunulmaz. Bir kayittaki
     * hata (ör. @Version cakismasi) yalniz o kaydi geri alir, digerleri islenir ve
     * bildirimleri (commit sonrasi) gider. Siradaki yedegin cagrilmasi AYRI bir
     * transaction'dadir: zincir devami patlarsa (repository hatasi transaction'i
     * rollback-only yapar) suresi dolma kaydi yine kalici olur — eski tek transaction'da
     * bu durum butun partiyi UnexpectedRollbackException ile geri aliyordu.
     */
    public int expireOverdueOffers() {
        LocalDateTime now = LocalDateTime.now(clock);
        List<Long> ids = applicationRepository
                .findByStatusAndStandbyDeadlineBefore(ApplicationStatus.STANDBY, now).stream()
                .map(Application::getId).toList();
        if (ids.isEmpty()) return 0;

        int n = 0, failed = 0;
        for (Long id : ids) {
            java.util.Optional<Long> replaces;   // null: islenmedi; bos: zincir devami yok
            try {
                replaces = perRecordTx.execute(st -> {
                    Application app = applicationRepository.findById(id).orElse(null);
                    if (app == null || app.getStatus() != ApplicationStatus.STANDBY
                            || app.getStandbyDeadline() == null
                            || !app.getStandbyDeadline().isBefore(now)) {
                        return null;
                    }
                    expireOffer(app, "Teklif süresi doldu");
                    applicationRepository.flush();   // @Version cakismasi burada, bu kayitta kalsin
                    return java.util.Optional.ofNullable(app.getStandbyReplacesApplicationId());
                });
            } catch (RuntimeException ex) {
                failed++;
                log.warn("[STANDBY] app={} teklif suresi kapatilamadi (sonraki calismada tekrar denenecek): {}",
                        id, ex.toString());
                continue;
            }
            if (replaces == null) continue;
            n++;
            if (replaces.isEmpty()) continue;
            Long noShowAppId = replaces.get();
            try {
                perRecordTx.executeWithoutResult(st -> offerAfterNoShow(noShowAppId));
            } catch (RuntimeException ex) {
                log.error("[STANDBY] app={} sonrasi siradaki yedege gecilemedi (no-show app={}): {}",
                        id, noShowAppId, ex.toString(), ex);
            }
        }
        if (failed > 0) log.warn("[STANDBY] {} / {} suresi gecen teklif islenemedi", failed, ids.size());
        return n;
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

    /**
     * Yedegin kabulunde koltuk: talep ettigi, bitmemis slotlardan bos olanlar
     * atomik olarak doldurulur (id sirasiyla). Hicbiri alinamazsa 422 ve tum
     * transaction geri alinir. Alinamayan/bitmis slotlar basvurudan cikar ki
     * ACCEPTED basvurunun her slotu tam bir koltuga karsilik gelsin.
     */
    private void claimOpenSeats(Application app) {
        if (app.getRequestedSlots() == null || app.getRequestedSlots().isEmpty()) return; // slotsuz eski akis
        LocalDateTime now = LocalDateTime.now(clock);
        Set<ShiftSlot> claimed = new HashSet<>();
        for (ShiftSlot slot : SlotSeats.byId(app.getRequestedSlots())) {
            if (!ShiftWindow.hasTimes(slot) || ShiftWindow.hasEnded(slot, now)) continue;
            if (SlotSeats.tryClaim(shiftSlotRepository, slot)) claimed.add(slot);
        }
        if (claimed.isEmpty()) {
            throw new BusinessRuleException(
                    "Bu vardiya doldu: teklif edilen koltuk bu arada başka biriyle kapandı.");
        }
        if (claimed.size() != app.getRequestedSlots().size()) {
            app.getRequestedSlots().removeIf(sl -> !claimed.contains(sl));
        }
    }

    /** Yedegin talep ettigi slotlardan biri bos ve bitmemis koltuklarla kesisiyor mu? */
    private static boolean matchesVacancy(Application standby, Set<Long> vacancy, LocalDateTime now) {
        if (standby.getRequestedSlots() == null || standby.getRequestedSlots().isEmpty()) {
            return false;
        }
        return standby.getRequestedSlots().stream()
                .anyMatch(sl -> vacancy.contains(sl.getId())
                        && ShiftWindow.hasTimes(sl) && !ShiftWindow.hasEnded(sl, now));
    }

    /**
     * Aktif yedek teklifi varsa (no-show yerine cagrilmis) yerine gectigi basvuru id'si.
     * Teklif cevaplanmadan basvuru cekilir/cikarilir/reddedilirse zincir devam etmeli.
     */
    public static Long activeOfferReplaces(Application app) {
        return app.getStatus() == ApplicationStatus.STANDBY && app.getStandbyOfferedAt() != null
                ? app.getStandbyReplacesApplicationId()
                : null;
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
