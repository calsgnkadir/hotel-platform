package com.hotelapp.service;

import com.hotelapp.dto.*;
import com.hotelapp.entity.*;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.DocumentRequestStatus;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ApplicationService {

    private final ApplicationRepository applicationRepository;
    private final UserRepository userRepository;
    private final JobListingRepository jobListingRepository;
    private final DocumentRequestRepository documentRequestRepository;

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

        boolean alreadyApplied = applicationRepository
                .findAllByCandidateId(candidateId).stream()
                .anyMatch(a -> a.getJobListing().getId().equals(request.getJobListingId())
                        && (a.getStatus() == ApplicationStatus.PENDING
                            || a.getStatus() == ApplicationStatus.REVIEWING));

        if (alreadyApplied) {
            throw new BusinessRuleException("Bu ilana zaten aktif bir başvurunuz var");
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

        return toResponse(application);
    }

    // ----------------------------------------------------------------
    // CANDIDATE: List own applications
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<ApplicationResponse> getCandidateApplications(Long candidateId) {
        return applicationRepository.findAllByCandidateId(candidateId)
                .stream().map(this::toResponse).toList();
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

        application.setStatus(request.getDecision());
        application.setNote(request.getNote());
        applicationRepository.save(application);
        return toResponse(application);
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
                .candidate(ApplicationResponse.CandidateSummary.builder()
                        .id(app.getCandidate().getId())
                        .fullName(app.getCandidate().getFullName())
                        .email(app.getCandidate().getEmail())
                        .build())
                .listing(ApplicationResponse.ListingSummary.builder()
                        .id(listing.getId())
                        .title(listing.getTitle())
                        .position(listing.getPosition().name())
                        .jobType(listing.getJobType().name())
                        .businessId(business.getId())
                        .businessName(business.getName())
                        .businessType(business.getType().name())
                        .build())
                .availabilities(avDtos)
                .documentRequests(drDtos)
                .build();
    }
}
