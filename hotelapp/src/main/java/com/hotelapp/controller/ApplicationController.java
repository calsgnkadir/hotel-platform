package com.hotelapp.controller;

import com.hotelapp.dto.ApplicationRequest;
import com.hotelapp.dto.ApplicationResponse;
import com.hotelapp.dto.DocRequestCreate;
import com.hotelapp.dto.PageResponse;
import com.hotelapp.dto.ReviewRequest;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.service.ApplicationService;
import com.hotelapp.service.ApplicationService.NoShowResult;
import com.hotelapp.service.DocumentService;
import com.hotelapp.service.DocumentService.DocumentDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
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

    @Operation(
            summary = "Başvurularımı listele (sayfalı) — sadece CANDIDATE",
            description = "Opsiyonel: status filtresi. Sayfalama: ?page=0&size=20&sort=createdAt,desc"
    )
    @GetMapping("/api/candidate/applications")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<PageResponse<ApplicationResponse>> myApplications(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @RequestParam(required = false) ApplicationStatus status,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(
                applicationService.getCandidateApplicationsPaged(currentUser.getId(), status, pageable));
    }

    @Operation(summary = "İlana başvur — sadece CANDIDATE")
    @PostMapping("/api/candidate/applications")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApplicationResponse> createApplication(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @Valid @RequestBody ApplicationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(applicationService.createApplication(currentUser.getId(), request));
    }

    @Operation(
            summary = "Başvuruyu iptal et — sadece CANDIDATE (kendi başvurusu)",
            description = "Sadece PENDING veya REVIEWING durumdaki başvurular iptal edilebilir. ACCEPTED ise iptal yapılamaz."
    )
    @PutMapping("/api/candidate/applications/{applicationId}/withdraw")
    // FAZ 4.9 — Method-level: sadece kendi basvurusunu iptal edebilir
    @PreAuthorize("hasRole('CANDIDATE') and @securityChecks.isApplicationCandidate(#p1)")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApplicationResponse> withdrawApplication(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long applicationId) {
        return ResponseEntity.ok(
                applicationService.withdrawApplication(applicationId, currentUser.getId()));
    }

    @Operation(summary = "Belge talebine yanıt ver (izin ver/reddet) — sadece CANDIDATE")
    @PutMapping("/api/candidate/document-requests/{requestId}/respond")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> respondToDocumentRequest(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long requestId,
            @RequestParam boolean grant) {
        applicationService.respondToDocumentRequest(requestId, currentUser.getId(), grant);
        return ResponseEntity.noContent().build();
    }

    // ============================================================
    // BUSINESS_OWNER
    // ============================================================

    @Operation(
            summary = "Gelen başvuruları listele (sayfalı) — sadece BUSINESS_OWNER",
            description = "Opsiyonel filtreler: status, listingId (ilan), q (aday adı arama). "
                    + "Sayfalama: ?page=0&size=20&sort=createdAt,desc"
    )
    @GetMapping("/api/business/applications")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<PageResponse<ApplicationResponse>> businessApplications(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @RequestParam(required = false) ApplicationStatus status,
            @RequestParam(required = false) Long listingId,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(
                applicationService.getBusinessApplicationsPaged(currentUser.getId(), status, listingId, q, pageable));
    }

    @Operation(summary = "Başvuruyu incelemeye al (PENDING → REVIEWING) — sadece BUSINESS_OWNER")
    @PutMapping("/api/business/applications/{applicationId}/review")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApplicationResponse> startReview(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long applicationId) {
        return ResponseEntity.ok(
                applicationService.startReview(applicationId, currentUser.getId()));
    }

    @Operation(summary = "FAZ 2/#28: Başvuruyu HOLD'a al — 24 saat içinde aday cevap verir")
    @PutMapping("/api/business/applications/{applicationId}/hold")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApplicationResponse> hold(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long applicationId) {
        return ResponseEntity.ok(
                applicationService.holdApplication(applicationId, currentUser.getId()));
    }

    @Operation(summary = "FAZ 2/#28: HOLD'daki başvuruya cevap ver (true=Onayla, false=Reddet)")
    @PutMapping("/api/candidate/applications/{applicationId}/respond-hold")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApplicationResponse> respondToHold(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long applicationId,
            @RequestParam boolean accept) {
        return ResponseEntity.ok(
                applicationService.respondToHold(applicationId, currentUser.getId(), accept));
    }

    @Operation(summary = "Başvuruyu sonuçlandır (ACCEPTED/REJECTED) — sadece BUSINESS_OWNER")
    @PutMapping("/api/business/applications/{applicationId}/decide")
    // FAZ 4.9 — Method-level: role + bu basvuru gerçekten benim isletmeme mi ait?
    @PreAuthorize("hasRole('BUSINESS_OWNER') and @securityChecks.isApplicationBusinessOwner(#p1)")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApplicationResponse> decide(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long applicationId,
            @Valid @RequestBody ReviewRequest request) {
        return ResponseEntity.ok(
                applicationService.reviewApplication(applicationId, currentUser.getId(), request));
    }

    @Operation(
            summary = "Kabul edilmiş başvuruyu NO-SHOW olarak işaretle — sadece BUSINESS_OWNER",
            description = "Adayın strike hakkı 1 düşer. Hak sıfıra inerse aday 30 gün otomatik banlanır ve hakları 3'e resetlenir."
    )
    @PutMapping("/api/business/applications/{applicationId}/no-show")
    // FAZ 4.9 — Method-level: bu basvuru benim isletmeme mi ait?
    @PreAuthorize("hasRole('BUSINESS_OWNER') and @securityChecks.isApplicationBusinessOwner(#p1)")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<NoShowResult> markNoShow(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long applicationId) {
        return ResponseEntity.ok(
                applicationService.markNoShow(applicationId, currentUser.getId()));
    }

    @Operation(summary = "Adaydan hassas belge talep et — sadece BUSINESS_OWNER")
    @PostMapping("/api/business/applications/{applicationId}/document-requests")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ApplicationResponse> requestDocument(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
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
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long applicationId) {
        return ResponseEntity.ok(documentService.getAccessibleDocsForApplication(applicationId, currentUser.getId()));
    }
}
