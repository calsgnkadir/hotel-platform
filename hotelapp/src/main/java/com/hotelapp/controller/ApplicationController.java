package com.hotelapp.controller;

import com.hotelapp.dto.ApplicationRequest;
import com.hotelapp.dto.ApplicationResponse;
import com.hotelapp.dto.DocRequestCreate;
import com.hotelapp.dto.ReviewRequest;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.service.ApplicationService;
import com.hotelapp.service.DocumentService;
import com.hotelapp.service.DocumentService.DocumentDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "7. Başvurular", description = "Aday başvuruları ve işletme inceleme akışı")
public class ApplicationController {

    private final ApplicationService applicationService;
    private final DocumentService documentService;

    // ============================================================
    // CANDIDATE
    // ============================================================

    @Operation(summary = "Başvurularımı listele — sadece CANDIDATE")
    @GetMapping("/api/candidate/applications")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<ApplicationResponse>> myApplications(
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(
                applicationService.getCandidateApplications(currentUser.getId()));
    }

    @Operation(summary = "İlana başvur — sadece CANDIDATE")
    @PostMapping("/api/candidate/applications")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApplicationResponse> createApplication(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody ApplicationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(applicationService.createApplication(currentUser.getId(), request));
    }

    @Operation(summary = "Belge talebine yanıt ver (izin ver/reddet) — sadece CANDIDATE")
    @PutMapping("/api/candidate/document-requests/{requestId}/respond")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> respondToDocumentRequest(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long requestId,
            @RequestParam boolean grant) {
        applicationService.respondToDocumentRequest(requestId, currentUser.getId(), grant);
        return ResponseEntity.noContent().build();
    }

    // ============================================================
    // BUSINESS_OWNER
    // ============================================================

    @Operation(
            summary = "Gelen başvuruları listele — sadece BUSINESS_OWNER",
            description = "status parametresi opsiyonel (PENDING, REVIEWING, ACCEPTED, REJECTED, EXPIRED)"
    )
    @GetMapping("/api/business/applications")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<ApplicationResponse>> businessApplications(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) ApplicationStatus status) {
        return ResponseEntity.ok(
                applicationService.getBusinessApplications(currentUser.getId(), status));
    }

    @Operation(summary = "Başvuruyu incelemeye al (PENDING → REVIEWING) — sadece BUSINESS_OWNER")
    @PutMapping("/api/business/applications/{applicationId}/review")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApplicationResponse> startReview(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long applicationId) {
        return ResponseEntity.ok(
                applicationService.startReview(applicationId, currentUser.getId()));
    }

    @Operation(summary = "Başvuruyu sonuçlandır (ACCEPTED/REJECTED) — sadece BUSINESS_OWNER")
    @PutMapping("/api/business/applications/{applicationId}/decide")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApplicationResponse> decide(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long applicationId,
            @Valid @RequestBody ReviewRequest request) {
        return ResponseEntity.ok(
                applicationService.reviewApplication(applicationId, currentUser.getId(), request));
    }

    @Operation(summary = "Adaydan hassas belge talep et — sadece BUSINESS_OWNER")
    @PostMapping("/api/business/applications/{applicationId}/document-requests")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApplicationResponse> requestDocument(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long applicationId,
            @Valid @RequestBody DocRequestCreate dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(applicationService.requestDocument(applicationId, currentUser.getId(), dto));
    }

    @Operation(summary = "Bu başvuru için erişebildiğim adayın belgeleri — BUSINESS_OWNER")
    @GetMapping("/api/business/applications/{applicationId}/documents")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<DocumentDto>> getAccessibleDocs(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long applicationId) {
        return ResponseEntity.ok(documentService.getAccessibleDocsForApplication(applicationId, currentUser.getId()));
    }
}
