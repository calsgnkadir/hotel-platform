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
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final JobListingRepository jobListingRepository;
    private final DocumentRequestRepository documentRequestRepository;
    private final ShiftSlotRepository shiftSlotRepository;
    private final FileStorageService fileStorageService;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final ReviewService reviewService;
    private final MessageService messageService;  // chat refactor: auto-conversation

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
        Application existing = applicationRepository
                .findAllByCandidateId(candidateId).stream()
                .filter(a -> a.getJobListing().getId().equals(request.getJobListingId())
                        && (a.getStatus() == ApplicationStatus.PENDING
                            || a.getStatus() == ApplicationStatus.REVIEWING
                            || a.getStatus() == ApplicationStatus.ACCEPTED))
                .findFirst().orElse(null);

        if (existing != null) {
            String msg = switch (existing.getStatus()) {
                case ACCEPTED  -> "Bu ilan için başvurunuz zaten kabul edildi. Tekrar başvuramazsınız.";
                case REVIEWING -> "Bu ilana yaptığınız başvuru işletme tarafından inceleniyor.";
                default        -> "Bu ilana zaten aktif bir başvurunuz var.";
            };
            throw new BusinessRuleException(msg);
        }

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
                // Chat-v2 bugfix: Geçmiş tarihli slot'a başvuru engellenir
                if (slot.getDate() != null && slot.getDate().isBefore(java.time.LocalDate.now())) {
                    throw new BusinessRuleException(
                            "Bu vardiya geçmişte: " + slot.getDate() + " " + slot.getStartTime() + "-" + slot.getEndTime());
                }
                selected.add(slot);
            }
            application.setRequestedSlots(selected);
        }

        applicationRepository.save(application);

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

        ApplicationResponse resp = toResponse(application);
        resp.setConversationId(conv.getId());   // Frontend bunu kullanarak /messages?open=<id>'e yönlendirir
        return resp;
    }

    // ----------------------------------------------------------------
    // CANDIDATE: List own applications
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<ApplicationResponse> getCandidateApplications(Long candidateId) {
        return applicationRepository.findAllByCandidateId(candidateId)
                .stream().map(this::toResponse).toList();
    }

    /** #84: Aday başvuruları — sayfalı + opsiyonel status filtresi. */
    @Transactional(readOnly = true)
    public PageResponse<ApplicationResponse> getCandidateApplicationsPaged(
            Long candidateId, ApplicationStatus status, Pageable pageable) {
        return PageResponse.of(
                applicationRepository.searchCandidateApplications(candidateId, status, pageable),
                this::toResponse);
    }

    // ----------------------------------------------------------------
    // BUSINESS OWNER: List incoming applications (optionally filtered)
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<ApplicationResponse> getBusinessApplications(Long ownerId, ApplicationStatus status) {
        List<Application> applications = (status != null)
                ? applicationRepository.findAllByJobListing_Business_OwnerIdAndStatus(ownerId, status)
                : applicationRepository.findAllByJobListing_Business_OwnerId(ownerId);
        return applications.stream().map(this::toResponse).toList();
    }

    /** #84: İşletme başvuruları — sayfalı + status/ilan/arama filtreleri. */
    @Transactional(readOnly = true)
    public PageResponse<ApplicationResponse> getBusinessApplicationsPaged(
            Long ownerId, ApplicationStatus status, Long listingId, String q, Pageable pageable) {
        String normalizedQ = (q != null && !q.isBlank()) ? q.trim() : null;
        return PageResponse.of(
                applicationRepository.searchBusinessApplications(ownerId, status, listingId, normalizedQ, pageable),
                this::toResponse);
    }

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
        return toResponse(application);
    }

    // ----------------------------------------------------------------
    // BUSINESS OWNER: Accept or reject application
    // ----------------------------------------------------------------
    @Transactional
    public ApplicationResponse reviewApplication(Long applicationId, Long ownerId, ReviewRequest request) {
        Application application = getApplicationForBusinessOwner(applicationId, ownerId);

        ApplicationStatus current = application.getStatus();
        if (current == ApplicationStatus.ACCEPTED
                || current == ApplicationStatus.REJECTED
                || current == ApplicationStatus.EXPIRED) {
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
        if (request.getDecision() == ApplicationStatus.ACCEPTED) {
            notificationService.notify(candidateId, NotificationType.APPLICATION_ACCEPTED,
                    "Başvurun kabul edildi 🎉",
                    listingTitle + " ilanına başvurun kabul edildi!",
                    "applications");
        } else {
            notificationService.notify(candidateId, NotificationType.APPLICATION_REJECTED,
                    "Başvurun reddedildi",
                    listingTitle + " ilanına başvurun maalesef reddedildi.",
                    "applications");
        }

        return toResponse(application);
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

        return toResponse(application);
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

        // D4: Audit log — no-show (işletme) + otomatik ban (sistem)
        auditLogService.log(ownerId, "MARK_NO_SHOW", "APPLICATION", applicationId,
                "Aday " + candidate.getEmail() + " no-show işaretlendi. Kalan strike: "
                        + candidate.getStrikesRemaining());
        if (autoBanned) {
            auditLogService.logSystem("AUTO_BAN", "USER", candidate.getId(),
                    "3 strike → " + candidate.getEmail() + " otomatik 30 gün banlandı (bitiş: " + bannedUntil + ")");
        }

        // Bildirim: adaya no-show (ve banlandıysa ekstra)
        notificationService.notify(candidate.getId(), NotificationType.NO_SHOW_MARKED,
                "İşe gelmedin olarak işaretlendin",
                application.getJobListing().getTitle() + " için no-show işaretlendin. Kalan strike hakkın: "
                        + candidate.getStrikesRemaining(),
                "applications");
        if (autoBanned) {
            notificationService.notify(candidate.getId(), NotificationType.AUTO_BANNED,
                    "Hesabın geçici olarak askıya alındı",
                    "Çok sayıda no-show nedeniyle hesabın " + bannedUntil.toLocalDate() + " tarihine kadar askıya alındı.",
                    null);
        }

        return NoShowResult.builder()
                .application(toResponse(application))
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

        return toResponse(application);
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

    // ----------------------------------------------------------------
    // Entity → DTO
    // ----------------------------------------------------------------
    private ApplicationResponse toResponse(Application app) {
        List<ApplicationResponse.AvailabilityDto> avDtos = app.getAvailabilities().stream()
                .map(av -> ApplicationResponse.AvailabilityDto.builder()
                        .dayOfWeek(av.getDayOfWeek())
                        .startTime(av.getStartTime())
                        .endTime(av.getEndTime())
                        .build())
                .toList();

        List<ApplicationResponse.DocumentRequestDto> drDtos = app.getDocumentRequests().stream()
                .map(dr -> ApplicationResponse.DocumentRequestDto.builder()
                        .id(dr.getId())
                        .documentType(dr.getDocumentType().name())
                        .status(dr.getStatus().name())
                        .requestedAt(dr.getRequestedAt())
                        .build())
                .toList();

        // Faz E1: Adayın başvurduğu slotlar (tarih+saate göre sıralı)
        List<RequestedSlotDto> slotDtos = (app.getRequestedSlots() == null) ? List.of()
                : app.getRequestedSlots().stream()
                    .sorted((a, b) -> {
                        int c = a.getDate().compareTo(b.getDate());
                        return c != 0 ? c : a.getStartTime().compareTo(b.getStartTime());
                    })
                    .map(s -> RequestedSlotDto.builder()
                            .id(s.getId())
                            .date(s.getDate())
                            .startTime(s.getStartTime())
                            .endTime(s.getEndTime())
                            .build())
                    .toList();

        JobListing listing = app.getJobListing();
        Business business = listing.getBusiness();

        return ApplicationResponse.builder()
                .id(app.getId())
                .status(app.getStatus())
                .coverLetter(app.getCoverLetter())
                .deadline(app.getDeadline())
                .createdAt(app.getCreatedAt())
                .note(app.getNote())
                .noShow(app.isNoShow())
                .workCompleted(reviewService.isWorkCompleted(app))
                .candidateReviewedBusiness(reviewService.hasCandidateReviewedBusiness(app.getId()))
                .candidate(buildCandidateSummary(app.getCandidate()))
                .listing(ApplicationResponse.ListingSummary.builder()
                        .id(listing.getId())
                        .title(listing.getTitle())
                        .position(listing.getPosition().name())
                        .jobType(listing.getJobType().name())
                        .businessId(business.getId())
                        .businessName(business.getName())
                        .businessType(business.getType().name())
                        .businessOwnerId(business.getOwner().getId())  // #77 mesajlaşma
                        .build())
                .availabilities(avDtos)
                .documentRequests(drDtos)
                .requestedSlots(slotDtos)
                .build();
    }

    /** Aday özeti — avatar + rating dahil */
    private ApplicationResponse.CandidateSummary buildCandidateSummary(User candidate) {
        var rating = reviewService.getCandidateRating(candidate.getId());
        return ApplicationResponse.CandidateSummary.builder()
                .id(candidate.getId())
                .fullName(candidate.getFullName())
                .email(candidate.getEmail())
                .avatarUrl(candidate.getAvatarPath() != null
                        ? fileStorageService.publicUrl(candidate.getAvatarPath())
                        : null)
                .averageRating(rating.getAverageRating())
                .reviewCount(rating.getReviewCount())
                .build();
    }
}
