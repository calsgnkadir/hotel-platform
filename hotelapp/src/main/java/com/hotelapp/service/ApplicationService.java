package com.hotelapp.service;

import com.hotelapp.dto.*;
import com.hotelapp.dto.ApplicationResponse.RequestedSlotDto;
import com.hotelapp.entity.*;
import com.hotelapp.entity.Conversation;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.enums.DocumentRequestStatus;
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
    private final DocumentRequestRepository documentRequestRepository;
    private final ShiftSlotRepository shiftSlotRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final MessageService messageService;  // chat refactor: auto-conversation
    private final EmailService emailService;
    private final EmailTemplates emailTemplates;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher; // FAZ 4.11 - no-show async
    private final ApplicationMapper applicationMapper; // FAZ 4.5 - god class temizligi (toResponse + buildCandidateSummary)
    private final org.springframework.beans.factory.ObjectProvider<com.hotelapp.metrics.AppMetrics> metricsProvider; // FAZ D.4

    @org.springframework.beans.factory.annotation.Value("${app.base-url:http://localhost:5173}")
    private String baseUrl;

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

        // Bu ilana zaten PENDING/REVIEWING/ACCEPTED başvurusu var mı?
        // - PENDING/REVIEWING: süreç henüz tamamlanmadı
        // - ACCEPTED: aday zaten kabul edildi, tekrar başvurmasına gerek yok
        // - REJECTED/EXPIRED: ikinci şans verilebilir (engellemiyoruz)
        applicationRepository.findFirstByCandidateIdAndJobListingIdAndStatusIn(
                candidateId,
                request.getJobListingId(),
                java.util.List.of(
                        ApplicationStatus.PENDING,
                        ApplicationStatus.REVIEWING,
                        ApplicationStatus.ACCEPTED))
            .ifPresent(existing -> {
                String msg = switch (existing.getStatus()) {
                    case ACCEPTED  -> "Bu ilan için başvurunuz zaten kabul edildi. Tekrar başvuramazsınız.";
                    case REVIEWING -> "Bu ilana yaptığınız başvuru işletme tarafından inceleniyor.";
                    default        -> "Bu ilana zaten aktif bir başvurunuz var.";
                };
                throw new BusinessRuleException(msg);
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
                    throw new BusinessRuleException("Slot bu ilana ait değil: " + slotId);
                }
                if (slot.isFull()) {
                    throw new BusinessRuleException(
                            "Seçtiğiniz slot dolu: " + slot.getDate() + " " + slot.getStartTime() + "-" + slot.getEndTime());
                }
                // F0/bugfix: Slot başlama anı geçmişse engellenir (tarih + saat birlikte)
                // ESKİ: sadece tarih kontrolü → bugün başlamış ama henüz bitmemiş vardiyaya başvuru kabul oluyordu.
                if (slot.getDate() != null && slot.getStartTime() != null) {
                    java.time.LocalDateTime slotStart = java.time.LocalDateTime.of(slot.getDate(), slot.getStartTime());
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

        // Aday başvuru sırasında belirli hassas belgelere önceden izin verdiyse,
        // her biri için GRANTED durumda DocumentRequest oluştur. İşletme görür/inceler.
        if (request.getGrantedSensitiveTypes() != null && !request.getGrantedSensitiveTypes().isEmpty()) {
            LocalDateTime now = LocalDateTime.now();
            for (com.hotelapp.enums.DocumentType type : request.getGrantedSensitiveTypes()) {
                DocumentRequest preGranted = DocumentRequest.builder()
                        .application(application)
                        .documentType(type)
                        .status(DocumentRequestStatus.GRANTED)
                        .respondedAt(now)
                        .build();
                documentRequestRepository.save(preGranted);
            }
        }

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
            throw new BusinessRuleException("Geçersiz karar. Sadece ACCEPTED veya REJECTED gönderin");
        }

        // Faz E1: ACCEPTED ise slot kapasitelerini güncelle
        if (request.getDecision() == ApplicationStatus.ACCEPTED
                && application.getRequestedSlots() != null
                && !application.getRequestedSlots().isEmpty()) {
            for (ShiftSlot slot : application.getRequestedSlots()) {
                if (slot.isFull()) {
                    throw new BusinessRuleException(
                            "Slot kapasitesi dolduğu için kabul edilemez: "
                            + slot.getDate() + " " + slot.getStartTime() + "-" + slot.getEndTime());
                }
                slot.setSlotsFilled(slot.getSlotsFilled() + 1);
                shiftSlotRepository.save(slot);
            }
        }

        application.setStatus(request.getDecision());
        application.setNote(request.getNote());
        applicationRepository.save(application);

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
            throw new BusinessRuleException("Yalniz PENDING/REVIEWING basvuru HOLD'a alinabilir. Mevcut: " + s);
        }
        app.setStatus(ApplicationStatus.HELD);
        app.setHoldDeadline(LocalDateTime.now().plusHours(24));
        applicationRepository.save(app);

        // Adaya bildirim: 24 saat icinde cevap vermesi gerek
        Long candidateId = app.getCandidate().getId();
        String listingTitle = app.getJobListing().getTitle();
        notificationService.notify(candidateId, NotificationType.APPLICATION_ACCEPTED,
                "İşletme seni tutmak istiyor ⏳",
                listingTitle + " ilanı için 24 saat içinde Onayla veya Reddet seç.",
                "applications");
        return applicationMapper.toResponse(app);
    }

    // ----------------------------------------------------------------
    // FAZ 2/#28 — CANDIDATE: HELD durumuna cevap ver (Onayla/Reddet)
    // ----------------------------------------------------------------
    @Transactional
    public ApplicationResponse respondToHold(Long applicationId, Long candidateId, boolean accept) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));
        if (!app.getCandidate().getId().equals(candidateId)) {
            throw new UnauthorizedException("Bu başvuru size ait değil");
        }
        if (app.getStatus() != ApplicationStatus.HELD) {
            throw new BusinessRuleException("Sadece HOLD durumundaki basvuruya cevap verilebilir. Mevcut: " + app.getStatus());
        }
        if (app.getHoldDeadline() != null && LocalDateTime.now().isAfter(app.getHoldDeadline())) {
            // Suresi gecmis - scheduler EXPIRED yapacak ama burada da tutarli olalim
            app.setStatus(ApplicationStatus.EXPIRED);
            applicationRepository.save(app);
            throw new BusinessRuleException("HOLD süresi dolmuş — başvuru sona erdi");
        }

        if (accept) {
            // ACCEPTED'e gec + slot kapasiteleri guncelle
            if (app.getRequestedSlots() != null) {
                for (ShiftSlot slot : app.getRequestedSlots()) {
                    if (slot.isFull()) {
                        throw new BusinessRuleException(
                                "Slot kapasitesi dolduğu için kabul edilemez: "
                                + slot.getDate() + " " + slot.getStartTime() + "-" + slot.getEndTime());
                    }
                    slot.setSlotsFilled(slot.getSlotsFilled() + 1);
                    shiftSlotRepository.save(slot);
                }
            }
            app.setStatus(ApplicationStatus.ACCEPTED);
        } else {
            app.setStatus(ApplicationStatus.WITHDRAWN);
        }
        applicationRepository.save(app);

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
                accept ? "Aday HOLD'u onayladı ✅" : "Aday HOLD'u reddetti",
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
            throw new UnauthorizedException("Bu başvuru size ait değil");
        }

        ApplicationStatus current = application.getStatus();
        if (current != ApplicationStatus.PENDING && current != ApplicationStatus.REVIEWING) {
            String msg = switch (current) {
                case ACCEPTED  -> "Kabul edilmiş başvuru iptal edilemez. İşletme ile iletişime geçin.";
                case REJECTED  -> "Bu başvuru zaten reddedilmiş.";
                case EXPIRED   -> "Bu başvurunun süresi dolmuş.";
                case WITHDRAWN -> "Bu başvuru zaten iptal edilmiş.";
                default        -> "Bu başvuru iptal edilemez. Mevcut durum: " + current;
            };
            throw new BusinessRuleException(msg);
        }

        application.setStatus(ApplicationStatus.WITHDRAWN);
        applicationRepository.save(application);

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
    // BUSINESS OWNER: Mark accepted candidate as no-show (D2)
    // - Sadece ACCEPTED başvuru işaretlenebilir
    // - Bir başvuru sadece BİR KEZ işaretlenebilir
    // - Adayın strikesRemaining'i 1 düşer
    // - 0'a düşerse 30 gün otomatik ban + strike 3'e reset
    // ----------------------------------------------------------------
    @Transactional
    public NoShowResult markNoShow(Long applicationId, Long ownerId) {
        Application application = getApplicationForBusinessOwner(applicationId, ownerId);

        if (application.getStatus() != ApplicationStatus.ACCEPTED) {
            throw new BusinessRuleException(
                    "Sadece KABUL EDİLMİŞ başvurular no-show olarak işaretlenebilir. Mevcut durum: "
                    + application.getStatus());
        }
        if (application.isNoShow()) {
            throw new BusinessRuleException("Bu başvuru zaten no-show olarak işaretlenmiş.");
        }

        // Başvuruyu işaretle
        application.setNoShow(true);

        // Adayın strike'ını düş
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

        // FAZ 4.11 — Side effect'ler (audit log + bildirim) async + AFTER_COMMIT.
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
                bannedUntil
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

    // ----------------------------------------------------------------
    // BUSINESS OWNER: Request sensitive document
    // ----------------------------------------------------------------
    @Transactional
    public ApplicationResponse requestDocument(Long applicationId, Long ownerId, DocRequestCreate dto) {
        Application application = getApplicationForBusinessOwner(applicationId, ownerId);

        boolean exists = documentRequestRepository
                .findByApplicationIdAndDocumentType(applicationId, dto.getDocumentType())
                .isPresent();

        if (exists) {
            throw new BusinessRuleException("Bu belge tipi için zaten bir talep oluşturulmuş");
        }

        DocumentRequest docRequest = DocumentRequest.builder()
                .application(application)
                .documentType(dto.getDocumentType())
                .build();

        documentRequestRepository.save(docRequest);

        // Bildirim: adaya belge talebi
        notificationService.notify(application.getCandidate().getId(), NotificationType.DOCUMENT_REQUEST,
                "Belge talebi",
                application.getJobListing().getBusiness().getName() + " senden "
                        + dto.getDocumentType().name() + " belgesi istedi",
                "applications");

        return applicationMapper.toResponse(application);
    }

    // ----------------------------------------------------------------
    // CANDIDATE: Respond to document request
    // ----------------------------------------------------------------
    @Transactional
    public void respondToDocumentRequest(Long requestId, Long candidateId, boolean grant) {
        DocumentRequest docRequest = documentRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Belge talebi", requestId));

        if (!docRequest.getApplication().getCandidate().getId().equals(candidateId)) {
            throw new UnauthorizedException("Bu talep size ait değil");
        }

        if (docRequest.getStatus() != DocumentRequestStatus.PENDING) {
            throw new BusinessRuleException("Bu talep zaten yanıtlanmış: " + docRequest.getStatus());
        }

        docRequest.setStatus(grant ? DocumentRequestStatus.GRANTED : DocumentRequestStatus.DENIED);
        docRequest.setRespondedAt(LocalDateTime.now());
        documentRequestRepository.save(docRequest);

        // Bildirim: işletmeye belge izni sonucu
        Application app = docRequest.getApplication();
        Long ownerId = app.getJobListing().getBusiness().getOwner().getId();
        notificationService.notify(ownerId,
                grant ? NotificationType.DOCUMENT_GRANTED : NotificationType.DOCUMENT_DENIED,
                grant ? "Belge izni verildi" : "Belge izni reddedildi",
                app.getCandidate().getFullName() + " · " + docRequest.getDocumentType().name()
                        + (grant ? " belgesine erişim verdi" : " belgesine erişimi reddetti"),
                "applications");
    }

    // ----------------------------------------------------------------
    // Helper: verify the application belongs to this business owner
    // ----------------------------------------------------------------
    private Application getApplicationForBusinessOwner(Long applicationId, Long ownerId) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));

        if (!application.getJobListing().getBusiness().getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Bu başvuru size ait değil");
        }
        return application;
    }

    // FAZ 4.5 — Entity -> DTO donusumu ApplicationMapper'a tasindi (god class temizligi).
}
