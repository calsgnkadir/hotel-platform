package com.hotelapp.service;

import com.hotelapp.dto.*;
import com.hotelapp.dto.ApplicationResponse.RequestedSlotDto;
import com.hotelapp.entity.*;
import com.hotelapp.entity.Conversation;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.*;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final JobListingRepository jobListingRepository;
    private final ShiftSlotRepository shiftSlotRepository;
    private final CandidateBlockRepository candidateBlockRepository; // isletme adayi engeller
    // FAZ 18 — Audit: AuditLogService DOGRUDAN cagrilmaz; outbox uzerinden
    // (at-least-once + retry). Eskiden burada kullanilmayan bir AuditLogService
    // injection'i duruyordu — basvuru kararlari hic audit'lenmiyordu.
    private final OutboxService outboxService;
    private final NotificationService notificationService;
    private final MessageService messageService;  // chat refactor: auto-conversation
    private final EmailService emailService;
    private final EmailTemplates emailTemplates;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher; // FAZ 4.11 - no-show async
    private final ApplicationMapper applicationMapper; // FAZ 4.5 - god class temizligi (toResponse + buildCandidateSummary)
    private final org.springframework.beans.factory.ObjectProvider<com.hotelapp.metrics.AppMetrics> metricsProvider; // FAZ D.4
    private final StandbyService standbyService;              // aktif yedek teklifi bozulursa zincir devam etsin
    private final WorkSessionRepository workSessionRepository; // no-show: girisi olan vardiya isaretlenemez
    private final ApplicationNoShowSlotRepository noShowSlotRepository; // V25: vardiya bazinda gelmedi isaretleri

    /** No-show zaman kontrolu icin (testte sabitlenebilir). Slot saatleri Turkiye yerel saati. */
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

    @org.springframework.beans.factory.annotation.Value("${app.base-url:http://localhost:5173}")
    private String baseUrl;

    /** Ayni ilana ikinci basvuruyu engelleyen (henuz sonuclanmamis ya da kabul) durumlar. */
    static final List<ApplicationStatus> ACTIVE_FOR_DUPLICATE = List.of(
            ApplicationStatus.PENDING,
            ApplicationStatus.REVIEWING,
            ApplicationStatus.HELD,
            ApplicationStatus.STANDBY,
            ApplicationStatus.ACCEPTED);

    // ----------------------------------------------------------------
    // CANDIDATE: Apply to a job listing
    // ----------------------------------------------------------------
    @Transactional
    public ApplicationResponse createApplication(Long candidateId, ApplicationRequest request) {
        User candidate = userRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Aday", candidateId));

        JobListing listing = jobListingRepository.findById(request.getJobListingId())
                .orElseThrow(() -> new ResourceNotFoundException("İlan", request.getJobListingId()));

        if (listing.getStatus() != ListingStatus.ACTIVE) {
            throw new BusinessRuleException("Bu ilan şu anda aktif değil");
        }

        // Isletme bu adayi engellediyse basvuru kaydi olusmaz (ilan gorunur kalir).
        requireNotBlockedByBusiness(listing.getBusiness().getId(), candidateId);

        // Bu ilana zaten aktif başvurusu var mı?
        // - PENDING/REVIEWING/HELD/STANDBY: süreç henüz tamamlanmadı
        // - ACCEPTED: aday zaten kabul edildi, tekrar başvurmasına gerek yok
        // - REJECTED/EXPIRED/WITHDRAWN: ikinci şans verilebilir (engellemiyoruz)
        applicationRepository.findFirstByCandidateIdAndJobListingIdAndStatusIn(
                candidateId,
                request.getJobListingId(),
                ACTIVE_FOR_DUPLICATE)
            .ifPresent(existing -> {
                String key = switch (existing.getStatus()) {
                    case ACCEPTED  -> "error.application.dupAccepted";
                    case REVIEWING -> "error.application.dupReviewing";
                    case HELD      -> "error.application.dupHeld";
                    case STANDBY   -> "error.application.dupStandby";
                    default        -> "error.application.dupActive";
                };
                throw BusinessRuleException.keyed(key);
            });

        Application application = Application.builder()
                .candidate(candidate)
                .jobListing(listing)
                .coverLetter(request.getCoverLetter())
                .build();

        if (request.getAvailabilities() != null) {
            List<Availability> availabilities = request.getAvailabilities().stream()
                    .map(dto -> Availability.builder()
                            .application(application)
                            .dayOfWeek(dto.getDayOfWeek())
                            .startTime(dto.getStartTime())
                            .endTime(dto.getEndTime())
                            .build())
                    .toList();
            application.setAvailabilities(availabilities);
        }

        // Faz E1: Slot bağlama + doluluk kontrolü
        // - slotIds opsiyonel (eski akışla uyumlu kalmak için), ama ilana slot eklendiyse zorunlu olmalı
        boolean listingHasSlots = listing.getShiftSlots() != null && !listing.getShiftSlots().isEmpty();
        if (listingHasSlots) {
            if (request.getSlotIds() == null || request.getSlotIds().isEmpty()) {
                throw new BusinessRuleException("Bu ilanda en az 1 vardiya slotu seçmelisiniz");
            }
            Set<ShiftSlot> selected = new HashSet<>();
            for (Long slotId : request.getSlotIds()) {
                ShiftSlot slot = shiftSlotRepository.findById(slotId)
                        .orElseThrow(() -> new ResourceNotFoundException("Vardiya slotu", slotId));
                if (!slot.getJobListing().getId().equals(listing.getId())) {
                    throw BusinessRuleException.keyed("error.listing.slotNotBelong", slotId);
                }
                if (slot.isFull()) {
                    throw new BusinessRuleException(
                            "Seçtiğiniz slot dolu: " + slot.getDate() + " " + slot.getStartTime() + "-" + slot.getEndTime());
                }
                // F0/bugfix: Slot başlama anı geçmişse engellenir (tarih + saat birlikte)
                // ESKİ: sadece tarih kontrolü → bugün başlamış ama henüz bitmemiş vardiyaya başvuru kabul oluyordu.
                if (slot.getDate() != null && slot.getStartTime() != null) {
                    java.time.LocalDateTime slotStart = ShiftWindow.startAt(slot.getDate(), slot.getStartTime());
                    if (slotStart.isBefore(java.time.LocalDateTime.now())) {
                        throw new BusinessRuleException(
                                "Bu vardiya başladı/geçti: " + slot.getDate() + " " + slot.getStartTime() + "-" + slot.getEndTime());
                    }
                }
                selected.add(slot);
            }
            application.setRequestedSlots(selected);
        }

        applicationRepository.save(application);

        // FAZ D.4 — Prometheus counter
        var m = metricsProvider.getIfAvailable();
        if (m != null) m.applicationsCreated.increment();

        // Chat refactor v2: NEW_APPLICATION bildirimi kaldırıldı.
        // Yerine NEW_MESSAGE bildirimi (auto-conversation içinde) gönderilir.
        // Eski enum durumunu korumak için kod silinmiyor, sadece tetikleyici.

        // Chat refactor v2: Başvuru yapıldığı an otomatik mesajlaşma açılır.
        // İlk mesaj (sistem) — aday tarafından gönderilmiş gibi görünür.
        String firstMessage = "Merhaba! \"" + listing.getTitle() + "\" ilanınıza başvurdum. "
                + "Detayları konuşmak isterim.";
        if (request.getCoverLetter() != null && !request.getCoverLetter().isBlank()) {
            firstMessage = request.getCoverLetter().trim();
        }
        Conversation conv = messageService.openConversationForApplication(application, firstMessage);

        ApplicationResponse resp = applicationMapper.toResponse(application);
        resp.setConversationId(conv.getId());   // Frontend bunu kullanarak /messages?open=<id>'e yönlendirir
        return resp;
    }

    // ----------------------------------------------------------------
    // List sorgulari ApplicationQueryService'e tasindi (FAZ C god class temizligi)
    // Unused unpaged getCandidate/BusinessApplications metodlari silindi (dead code).
    // ----------------------------------------------------------------
    // BUSINESS OWNER: Move PENDING → REVIEWING
    // ----------------------------------------------------------------
    @Transactional
    public ApplicationResponse startReview(Long applicationId, Long ownerId) {
        Application application = getApplicationForBusinessOwner(applicationId, ownerId);

        if (application.getStatus() != ApplicationStatus.PENDING) {
            throw new BusinessRuleException(
                    "Sadece PENDING durumdaki başvurular incelemeye alınabilir. Mevcut durum: "
                    + application.getStatus());
        }

        application.setStatus(ApplicationStatus.REVIEWING);
        application.setReviewedAt(LocalDateTime.now());
        applicationRepository.save(application);
        return applicationMapper.toResponse(application);
    }

    // ----------------------------------------------------------------
    // BUSINESS OWNER: Accept or reject application
    // ----------------------------------------------------------------
    @Transactional
    public ApplicationResponse reviewApplication(Long applicationId, Long ownerId, ReviewRequest request) {
        Application application = getApplicationForBusinessOwner(applicationId, ownerId);

        ApplicationStatus current = application.getStatus();
        // FAZ 2/#28: HELD durumdaysa isletme yine karar verebilir (HOLD'dan vazgec)
        if (current == ApplicationStatus.ACCEPTED
                || current == ApplicationStatus.REJECTED
                || current == ApplicationStatus.EXPIRED
                || current == ApplicationStatus.WITHDRAWN) {
            throw new BusinessRuleException("Bu başvuru zaten sonuçlandırılmış: " + current);
        }

        if (request.getDecision() != ApplicationStatus.ACCEPTED
                && request.getDecision() != ApplicationStatus.REJECTED) {
            throw BusinessRuleException.keyed("error.application.decisionInvalid");
        }

        // Aktif yedek teklifi olan aday reddedilirse acik kapanmadan kalmasin.
        Long cascadeFor = request.getDecision() == ApplicationStatus.REJECTED
                ? StandbyService.activeOfferReplaces(application) : null;

        application.setStatus(request.getDecision());
        application.setNote(request.getNote());
        // FAZ C.1 — Yedekteki aday dogrudan sonuclandirildiysa yedek alanlari temizlenir;
        // aksi halde acik kalan teklif scheduler'i yaniltir.
        if (current == ApplicationStatus.STANDBY) {
            application.setStandbyRank(null);
            application.setStandbyOfferedAt(null);
            application.setStandbyDeadline(null);
            application.setStandbyReplacesApplicationId(null);
        }
        // Once basvuru (iyimser kilit, V22): ayni anda baska bir gecis olduysa 409.
        applicationRepository.saveAndFlush(application);

        // Faz E1 + K1: ACCEPTED ise koltuklar kosullu atomik UPDATE ile alinir;
        // biri doluysa 422 ve tum transaction (basvuru durumu dahil) geri alinir.
        if (request.getDecision() == ApplicationStatus.ACCEPTED) {
            SlotSeats.claimAll(shiftSlotRepository, application.getRequestedSlots());
        }
        if (cascadeFor != null) {
            standbyService.offerAfterNoShow(cascadeFor);
        }

        // FAZ 18 — Audit: baglayici karar, kim/ne zaman izlenebilmeli
        outboxService.appendAuditLog(com.hotelapp.event.AuditLoggedEvent.user(
                ownerId,
                request.getDecision() == ApplicationStatus.ACCEPTED ? "ACCEPT_APPLICATION" : "REJECT_APPLICATION",
                "APPLICATION", applicationId,
                "İlan: " + application.getJobListing().getTitle()
                        + " · Aday: " + application.getCandidate().getEmail()
                        + " · Önceki durum: " + current
                        + (request.getNote() != null && !request.getNote().isBlank()
                            ? " · Not: " + request.getNote() : "")));

        // Bildirim: adaya kabul/red
        Long candidateId = application.getCandidate().getId();
        String listingTitle = application.getJobListing().getTitle();
        String candidateEmail = application.getCandidate().getEmail();
        String candidateName = application.getCandidate().getFullName();
        String businessName = application.getJobListing().getBusiness().getName();

        if (request.getDecision() == ApplicationStatus.ACCEPTED) {
            notificationService.notify(candidateId, NotificationType.APPLICATION_ACCEPTED,
                    "Başvurun kabul edildi",
                    listingTitle + " ilanına başvurun kabul edildi!",
                    "applications");
            // FAZ 3 — Email: kabul (sessiz fail)
            try {
                String html = emailTemplates.applicationAccepted(
                        candidateName, listingTitle, businessName, baseUrl + "/candidate");
                emailService.queue(candidateEmail, "Başvurun kabul edildi — " + listingTitle, html);
            } catch (Exception ex) {
                log.warn("[ACCEPT-EMAIL] Gonderilemedi (yok sayildi): app={} sebep={}",
                        applicationId, ex.getMessage());
            }
        } else {
            notificationService.notify(candidateId, NotificationType.APPLICATION_REJECTED,
                    "Başvurun reddedildi",
                    listingTitle + " ilanına başvurun maalesef reddedildi.",
                    "applications");
            // FAZ 3 — Email: red (yumusak ton)
            try {
                String html = emailTemplates.applicationRejected(
                        candidateName, listingTitle, businessName,
                        request.getNote(), baseUrl + "/candidate");
                emailService.queue(candidateEmail, "Başvurun yanıtlandı — " + listingTitle, html);
            } catch (Exception ex) {
                log.warn("[REJECT-EMAIL] Gonderilemedi (yok sayildi): app={} sebep={}",
                        applicationId, ex.getMessage());
            }
        }

        return applicationMapper.toResponse(application);
    }

    // ----------------------------------------------------------------
    // FAZ 2/#28 — BUSINESS OWNER: Basvuruyu HOLD'a al (24 saat aday cevap versin)
    // ----------------------------------------------------------------
    @Transactional
    public ApplicationResponse holdApplication(Long applicationId, Long ownerId) {
        Application app = getApplicationForBusinessOwner(applicationId, ownerId);
        ApplicationStatus s = app.getStatus();
        if (s != ApplicationStatus.PENDING && s != ApplicationStatus.REVIEWING) {
            throw BusinessRuleException.keyed("error.application.holdOnlyPending", s);
        }
        app.setStatus(ApplicationStatus.HELD);
        app.setHoldDeadline(LocalDateTime.now().plusHours(24));
        applicationRepository.save(app);

        // FAZ 18 — Audit
        outboxService.appendAuditLog(com.hotelapp.event.AuditLoggedEvent.user(
                ownerId, "HOLD_APPLICATION", "APPLICATION", applicationId,
                "İlan: " + app.getJobListing().getTitle()
                        + " · Aday: " + app.getCandidate().getEmail()
                        + " · Son tarih: " + app.getHoldDeadline()));

        // Adaya bildirim: 24 saat icinde cevap vermesi gerek
        Long candidateId = app.getCandidate().getId();
        String listingTitle = app.getJobListing().getTitle();
        notificationService.notify(candidateId, NotificationType.APPLICATION_ACCEPTED,
                "İşletme seni tutmak istiyor",
                listingTitle + " ilanı için 24 saat içinde Onayla veya Reddet seç.",
                "applications");
        return applicationMapper.toResponse(app);
    }

    // ----------------------------------------------------------------
    // FAZ 2/#28 — CANDIDATE: HELD durumuna cevap ver (Onayla/Reddet)
    // ----------------------------------------------------------------
    @Transactional(noRollbackFor = com.hotelapp.exception.OfferExpiredException.class)
    public ApplicationResponse respondToHold(Long applicationId, Long candidateId, boolean accept) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));
        if (!app.getCandidate().getId().equals(candidateId)) {
            throw UnauthorizedException.keyed("error.application.notOwner");
        }
        if (app.getStatus() != ApplicationStatus.HELD) {
            throw BusinessRuleException.keyed("error.application.holdRespondOnly", app.getStatus());
        }
        if (app.getHoldDeadline() != null && LocalDateTime.now().isAfter(app.getHoldDeadline())) {
            // Suresi gecmis: EXPIRED kalici olur (noRollbackFor), sonra 422.
            app.setStatus(ApplicationStatus.EXPIRED);
            applicationRepository.save(app);
            throw com.hotelapp.exception.OfferExpiredException.keyed("error.application.holdExpired");
        }

        if (accept) {
            // Engel aninda HELD basvurular REJECTED olur; bu kontrol yaris durumuna karsi yedek.
            requireNotBlockedByBusiness(app.getJobListing().getBusiness().getId(), candidateId);
            // ACCEPTED'e gec (iyimser kilit) + koltuklari atomik al (hepsi ya da hicbiri)
            app.setStatus(ApplicationStatus.ACCEPTED);
            applicationRepository.saveAndFlush(app);
            SlotSeats.claimAll(shiftSlotRepository, app.getRequestedSlots());
        } else {
            app.setStatus(ApplicationStatus.WITHDRAWN);
            applicationRepository.save(app);
        }

        // FAZ 18 — Audit: adayin HOLD yaniti (baglayici kabul / vazgecme)
        outboxService.appendAuditLog(com.hotelapp.event.AuditLoggedEvent.user(
                candidateId,
                accept ? "HOLD_ACCEPTED_BY_CANDIDATE" : "HOLD_REJECTED_BY_CANDIDATE",
                "APPLICATION", applicationId,
                "İlan: " + app.getJobListing().getTitle()
                        + " · İşletme: " + app.getJobListing().getBusiness().getName()));

        // FAZ D.4 — Prometheus counter (sadece accept için)
        if (accept) {
            var m = metricsProvider.getIfAvailable();
            if (m != null) m.applicationsAccepted.increment();
        }

        // Isletmeye bildirim
        Long ownerId = app.getJobListing().getBusiness().getOwner().getId();
        String listingTitle = app.getJobListing().getTitle();
        notificationService.notify(ownerId,
                accept ? NotificationType.APPLICATION_ACCEPTED : NotificationType.APPLICATION_WITHDRAWN,
                accept ? "Aday HOLD'u onayladı" : "Aday HOLD'u reddetti",
                "\"" + listingTitle + "\" — aday cevabını verdi.",
                "applications");
        return applicationMapper.toResponse(app);
    }

    // ----------------------------------------------------------------
    // CANDIDATE: Withdraw own application (D6)
    // - Sadece PENDING/REVIEWING başvurular iptal edilebilir
    //   (henüz işletme planlamamış, iptal aday hakkıdır)
    // - ACCEPTED ise işletme planlamış, iptal yasak — "İletişime geçin" mesajı
    //   (Eğer aday gerçekten gelmezse işletme NO-SHOW işaretler, strike düşer)
    // - Aday başka birinin başvurusunu iptal edemez
    // ----------------------------------------------------------------
    @Transactional
    public ApplicationResponse withdrawApplication(Long applicationId, Long candidateId) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));

        if (!application.getCandidate().getId().equals(candidateId)) {
            throw UnauthorizedException.keyed("error.application.notOwner");
        }

        ApplicationStatus current = application.getStatus();
        // FAZ C.1 — Yedek aday da yedeklikten cekilebilir (aktif teklif varsa
        // "respond-standby" akisi kullanilir, orada isletmeye ayrica bildirim gider).
        if (current != ApplicationStatus.PENDING
                && current != ApplicationStatus.REVIEWING
                && current != ApplicationStatus.STANDBY) {
            String msg = switch (current) {
                case ACCEPTED  -> "Kabul edilmiş başvuru iptal edilemez. İşletme ile iletişime geçin.";
                case REJECTED  -> "Bu başvuru zaten reddedilmiş.";
                case EXPIRED   -> "Bu başvurunun süresi dolmuş.";
                case WITHDRAWN -> "Bu başvuru zaten iptal edilmiş.";
                default        -> "Bu başvuru iptal edilemez. Mevcut durum: " + current;
            };
            throw new BusinessRuleException(msg);
        }

        Long cascadeFor = StandbyService.activeOfferReplaces(application);
        application.setStatus(ApplicationStatus.WITHDRAWN);
        if (current == ApplicationStatus.STANDBY) {
            application.setStandbyRank(null);
            application.setStandbyOfferedAt(null);
            application.setStandbyDeadline(null);
            application.setStandbyReplacesApplicationId(null);
        }
        applicationRepository.save(application);
        // Aktif teklifi olan yedek cekildi: siradaki yedege gec.
        if (cascadeFor != null) {
            standbyService.offerAfterNoShow(cascadeFor);
        }

        // FAZ 18 — Audit
        outboxService.appendAuditLog(com.hotelapp.event.AuditLoggedEvent.user(
                candidateId, "WITHDRAW_APPLICATION", "APPLICATION", applicationId,
                "İlan: " + application.getJobListing().getTitle()
                        + " · Önceki durum: " + current));

        // Bildirim: işletmeye aday iptali
        Long ownerId = application.getJobListing().getBusiness().getOwner().getId();
        notificationService.notify(ownerId, NotificationType.APPLICATION_WITHDRAWN,
                "Başvuru iptal edildi",
                application.getCandidate().getFullName() + " · "
                        + application.getJobListing().getTitle() + " başvurusunu iptal etti",
                "applications");

        return applicationMapper.toResponse(application);
    }

    // ----------------------------------------------------------------
    // BUSINESS OWNER: Mark accepted candidate as no-show (D2) — vardiya bazinda (V25)
    // - Sadece ACCEPTED başvuru işaretlenebilir
    // - Vardiya başlangıcı + 30 dk geçmeden işaretlenemez
    // - Giriş kaydı (QR / elle / GPS) olan vardiya işaretlenemez
    // - Her çağrı TEK vardiya işaretler: slotId verilirse o vardiya; verilmezse şu an
    //   devam eden ya da en son başlamış vardiya (eski, bitmiş vardiyalar otomatik seçilmez)
    // - İşaretlenen vardiya başvurudan ÇIKMAZ (çalışılmış diğer vardiyalar ve kazanç
    //   korunur); application_no_show_slots'a satır eklenir, koltuk atomik boşalır
    // - Ceza vardiya başına: her yeni işaret strikesRemaining'i 1 düşürür
    // - 0'a düşerse 30 gün otomatik ban + strike 3'e reset
    // ----------------------------------------------------------------
    @Transactional
    public NoShowResult markNoShow(Long applicationId, Long ownerId) {
        return markNoShow(applicationId, ownerId, null);
    }

    static final String NO_SHOW_ALREADY_MARKED = "Bu vardiya zaten gelmedi olarak işaretlendi.";

    @Transactional
    public NoShowResult markNoShow(Long applicationId, Long ownerId, Long slotId) {
        // Giris yollariyla (QR/elle/GPS) ayni satir kilidi: "giris var mi" ve "zaten
        // isaretli mi" kontrolleri yarissiz (ayni basvuruya iki isaret sirayla islenir).
        Application application = applicationRepository.findByIdForCheckIn(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));
        if (!application.getJobListing().getBusiness().getOwner().getId().equals(ownerId)) {
            throw UnauthorizedException.keyed("error.application.notOwner");
        }

        if (application.getStatus() != ApplicationStatus.ACCEPTED) {
            throw new BusinessRuleException(
                    "Sadece KABUL EDİLMİŞ başvurular no-show olarak işaretlenebilir. Mevcut durum: "
                    + application.getStatus());
        }
        // V25 oncesi isaret (ya da slotsuz basvuru): eski akista tum koltuklar zaten
        // bosaltildi; yeni vardiya isareti cift bosaltma olurdu.
        if (NoShowSlots.isLegacy(application)) {
            throw new BusinessRuleException("Bu başvuru zaten no-show olarak işaretlenmiş.");
        }

        ShiftSlot slot = selectNoShowSlot(application, slotId);
        List<Long> vacatedIds = List.of();
        if (slot != null) {
            // Once satir (unique application+slot), sonra koltuk: ihlalde bosaltma olmaz.
            ApplicationNoShowSlot mark;
            try {
                mark = noShowSlotRepository.saveAndFlush(ApplicationNoShowSlot.builder()
                        .application(application)
                        .shiftSlot(slot)
                        .markedAt(LocalDateTime.now(clock))
                        .build());
            } catch (org.springframework.dao.DataIntegrityViolationException dup) {
                throw new BusinessRuleException(NO_SHOW_ALREADY_MARKED);
            }
            application.getNoShowSlots().add(mark);
            // FAZ C.1 — Aday gelmedi: koltuk atomik bosalir ki yedek doldurabilsin.
            SlotSeats.release(shiftSlotRepository, slot);
            vacatedIds = List.of(slot.getId());
        }
        // Geriye uyum: en az bir gelmedi isareti varsa basvuru bayragi true.
        application.setNoShow(true);

        // Ceza vardiya basina: her yeni isaret 1 strike.
        User candidate = application.getCandidate();
        int remaining = Math.max(0, candidate.getStrikesRemaining() - 1);
        candidate.setStrikesRemaining(remaining);

        boolean autoBanned = false;
        LocalDateTime bannedUntil = null;
        if (remaining <= 0) {
            // Otomatik ban: 30 gün
            bannedUntil = LocalDateTime.now().plusDays(30);
            candidate.setBannedUntil(bannedUntil);
            // Ban sonrası tekrar 3 hak tanı
            candidate.setStrikesRemaining(3);
            autoBanned = true;
        }

        userRepository.save(candidate);
        applicationRepository.save(application);

        // FAZ 4.11 — Side effect'ler (audit log + bildirim + yedek zinciri) async + AFTER_COMMIT.
        // NoShowEventListener bu event'i ayri thread'de handle eder.
        eventPublisher.publishEvent(new com.hotelapp.event.NoShowMarkedEvent(
                ownerId,
                applicationId,
                candidate.getId(),
                candidate.getEmail(),
                candidate.getFullName(),
                application.getJobListing().getTitle(),
                candidate.getStrikesRemaining(),
                autoBanned,
                bannedUntil,
                vacatedIds
        ));

        return NoShowResult.builder()
                .application(applicationMapper.toResponse(application))
                .candidateStrikesRemaining(candidate.getStrikesRemaining())
                .autoBanned(autoBanned)
                .bannedUntil(bannedUntil)
                .build();
    }

    @Data @Builder
    public static class NoShowResult {
        private ApplicationResponse application;
        private Integer candidateStrikesRemaining;
        private Boolean autoBanned;
        private LocalDateTime bannedUntil;
    }

    /**
     * Gelmedi isaretlenecek TEK vardiya. Slotsuz eski basvuruda null.
     * Kurallar: baslangic + 30 dk gecmis olmali, giris kaydi olmamali, daha once
     * isaretlenmemis olmali. slotId yoksa yalniz en son baslamis vardiya adaydir —
     * o uygun degilse daha eski (bitmis) vardiyalara dusulmez.
     */
    private ShiftSlot selectNoShowSlot(Application application, Long slotId) {
        Set<ShiftSlot> slots = application.getRequestedSlots();
        if (slots == null || slots.isEmpty()) {
            if (slotId != null) {
                throw new BusinessRuleException("Bu vardiya bu başvuruya ait değil.");
            }
            return null;   // slotsuz eski akis
        }
        LocalDateTime now = LocalDateTime.now(clock);
        Set<Long> marked = NoShowSlots.ids(application);
        List<WorkSession> sessions = workSessionRepository.findByApplicationIdOrderByClockInAtDesc(application.getId());

        ShiftSlot slot;
        if (slotId != null) {
            slot = slots.stream().filter(sl -> slotId.equals(sl.getId())).findFirst()
                    .orElseThrow(() -> new BusinessRuleException("Bu vardiya bu başvuruya ait değil."));
            if (marked.contains(slot.getId())) {
                throw new BusinessRuleException(NO_SHOW_ALREADY_MARKED);
            }
            if (!ShiftWindow.hasTimes(slot) || !ShiftWindow.noShowAllowed(slot, now)) {
                throw new BusinessRuleException(
                        "Gelmedi işareti vardiya başladıktan 30 dakika sonra verilebilir ("
                        + SlotSeats.label(slot) + ").");
            }
        } else {
            // Devam eden vardiya varsa o (en gec baslayan), yoksa en son baslamis vardiya.
            slot = slots.stream()
                    .filter(ShiftWindow::hasTimes)
                    .filter(sl -> ShiftWindow.noShowAllowed(sl, now))
                    .max(java.util.Comparator.<ShiftSlot, LocalDateTime>comparing(ShiftWindow::startAt)
                            .thenComparing(ShiftSlot::getId))
                    .orElseThrow(() -> new BusinessRuleException(
                            "Gelmedi işareti vardiya başladıktan 30 dakika sonra verilebilir."));
            if (marked.contains(slot.getId())) {
                throw new BusinessRuleException(NO_SHOW_ALREADY_MARKED);
            }
        }
        if (ShiftAttendance.sessionFor(application, slot, sessions).isPresent()) {
            throw new BusinessRuleException(
                    "Bu vardiya için giriş kaydı var; gelmedi olarak işaretlenemez ("
                    + SlotSeats.label(slot) + ").");
        }
        return slot;
    }

    /** Isletme bu adayi engellediyse 422 (engel ayrica ifsa edilmez). */
    private void requireNotBlockedByBusiness(Long businessId, Long candidateId) {
        if (candidateBlockRepository.existsByBusinessIdAndCandidateId(businessId, candidateId)) {
            throw new BusinessRuleException("Bu işletmeye başvuru yapamazsın.");
        }
    }

    // ----------------------------------------------------------------
    // Helper: verify the application belongs to this business owner
    // ----------------------------------------------------------------
    private Application getApplicationForBusinessOwner(Long applicationId, Long ownerId) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));

        if (!application.getJobListing().getBusiness().getOwner().getId().equals(ownerId)) {
            throw UnauthorizedException.keyed("error.application.notOwner");
        }
        return application;
    }

    // FAZ 4.5 — Entity -> DTO donusumu ApplicationMapper'a tasindi (god class temizligi).
}
