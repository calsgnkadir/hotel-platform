package com.hotelapp.controller;

import com.hotelapp.enums.Role;
import com.hotelapp.enums.ReportStatus;
import com.hotelapp.service.AdminService;
import com.hotelapp.service.AdminService.BanRequest;
import com.hotelapp.service.AdminService.StatsDto;
import com.hotelapp.service.AdminService.StudentStatusRequest;
import com.hotelapp.service.AdminService.UserDetail;
import com.hotelapp.service.AdminService.UserSummary;
import com.hotelapp.service.ReportService;
import com.hotelapp.service.ReportService.ReportDto;
import com.hotelapp.service.ReportService.UpdateReportStatusRequest;
import com.hotelapp.service.AuditLogService;
import com.hotelapp.service.AuditLogService.AuditLogDto;
import com.hotelapp.service.OutboxAdminService;
import com.hotelapp.service.OutboxAdminService.OutboxEventDto;
import com.hotelapp.service.OutboxService;
import com.hotelapp.service.SupportTicketService;
import com.hotelapp.service.SupportTicketService.TicketDto;
import com.hotelapp.service.SupportTicketService.UpdateStatusRequest;
import com.hotelapp.enums.SupportStatus;
import com.hotelapp.event.AuditLoggedEvent;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "9. Admin", description = "Sadece ADMIN — kullanıcı yönetimi, öğrenci onayı, ban, istatistikler")
public class AdminController {

    private final AdminService adminService;
    private final ReportService reportService;
    private final AuditLogService auditLogService;
    private final OutboxService outboxService; // FAZ C.2 — outbox via append
    private final OutboxAdminService outboxAdminService; // FAZ D.5
    private final SupportTicketService supportService;   // FAZ I.5

    // ================================================================
    // İşlem geçmişi (D4 audit log)
    // ================================================================

    @Operation(summary = "İşlem geçmişi (audit log) — son N kayıt")
    @GetMapping("/audit-logs")
    public ResponseEntity<List<AuditLogDto>> listAuditLogs(
            @RequestParam(required = false) String action,
            @RequestParam(required = false, defaultValue = "100") int limit) {
        return ResponseEntity.ok(auditLogService.list(action, limit));
    }

    // ================================================================
    // Şikayetler (D8)
    // ================================================================

    @Operation(summary = "Şikayetleri listele (opsiyonel status filtresi)")
    @GetMapping("/reports")
    public ResponseEntity<List<ReportDto>> listReports(
            @RequestParam(required = false) ReportStatus status) {
        return ResponseEntity.ok(reportService.listReports(status));
    }

    @Operation(summary = "Şikayet durumunu güncelle (RESOLVED/DISMISSED)")
    @PutMapping("/reports/{id}/status")
    public ResponseEntity<ReportDto> updateReportStatus(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long id,
            @Valid @RequestBody UpdateReportStatusRequest request) {
        ReportDto result = reportService.updateStatus(id, request.getStatus(), request.getAdminNote());
        outboxService.appendAuditLog(AuditLoggedEvent.user(currentUser.getId(),
                request.getStatus().name().equals("RESOLVED") ? "RESOLVE_REPORT" : "DISMISS_REPORT",
                "REPORT", id,
                "Şikayet #" + id + " → " + request.getStatus()));
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Kullanıcıları listele (filtre + arama)")
    @GetMapping("/users")
    public ResponseEntity<List<UserSummary>> listUsers(
            @RequestParam(required = false) Role role,
            @RequestParam(required = false, defaultValue = "") String search) {
        return ResponseEntity.ok(adminService.listUsers(role, search));
    }

    @Operation(summary = "Tek kullanıcı detayı")
    @GetMapping("/users/{id}")
    public ResponseEntity<UserDetail> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.getUser(id));
    }

    @Operation(summary = "Öğrenci statüsünü onayla/iptal et")
    @PutMapping("/users/{id}/student-status")
    public ResponseEntity<UserSummary> setStudentStatus(
            @PathVariable Long id,
            @Valid @RequestBody StudentStatusRequest request) {
        return ResponseEntity.ok(adminService.setStudentStatus(id, request.getApproved()));
    }

    @Operation(summary = "Kullanıcıyı banla (gün cinsinden süre)")
    @PutMapping("/users/{id}/ban")
    public ResponseEntity<UserSummary> ban(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long id,
            @Valid @RequestBody BanRequest request) {
        UserSummary result = adminService.ban(id, request.getDays());
        outboxService.appendAuditLog(AuditLoggedEvent.user(currentUser.getId(), "BAN_USER", "USER", id,
                request.getDays() + " gün ban (" + result.getEmail() + ")"));
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Banı kaldır")
    @PutMapping("/users/{id}/unban")
    public ResponseEntity<UserSummary> unban(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long id) {
        UserSummary result = adminService.unban(id);
        outboxService.appendAuditLog(AuditLoggedEvent.user(currentUser.getId(), "UNBAN_USER", "USER", id,
                "Ban kaldırıldı (" + result.getEmail() + ")"));
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Platform istatistikleri")
    @GetMapping("/stats")
    public ResponseEntity<StatsDto> getStats() {
        return ResponseEntity.ok(adminService.getStats());
    }

    // ================================================================
    // FAZ 6.3 — Listing moderation
    // ================================================================

    @Operation(summary = "İlan moderasyon listesi (status filtreli + arama)")
    @GetMapping("/listings")
    public ResponseEntity<List<AdminService.AdminListingDto>> listListings(
            @RequestParam(required = false) com.hotelapp.enums.ListingStatus status,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(adminService.listListingsForAdmin(status, search));
    }

    // ================================================================
    // FAZ D.5 — Outbox DLQ goruntuleme + manuel retry
    // ================================================================

    @Operation(
            summary = "Outbox event listesi",
            description = "filter: all | pending | dead. DEAD = attempts>=5, hala teslim edilmemis."
    )
    @GetMapping("/outbox")
    public ResponseEntity<List<OutboxEventDto>> listOutbox(
            @RequestParam(required = false, defaultValue = "all") String filter,
            @RequestParam(required = false, defaultValue = "50") int limit) {
        return ResponseEntity.ok(outboxAdminService.list(filter, limit));
    }

    @Operation(summary = "Outbox event'i tekrar denemeye al (attempts/lastError sifirlanir)")
    @PostMapping("/outbox/{id}/retry")
    public ResponseEntity<Void> retryOutbox(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long id) {
        outboxAdminService.retry(id);
        outboxService.appendAuditLog(AuditLoggedEvent.user(currentUser.getId(),
                "OUTBOX_RETRY", "OUTBOX_EVENT", id, "Manuel retry tetiklendi"));
        return ResponseEntity.noContent().build();
    }

    // ================================================================
    // FAZ I.5 — Destek bileti moderasyonu
    // ================================================================

    @Operation(summary = "Destek biletlerini listele (status opsiyonel)")
    @GetMapping("/support")
    public ResponseEntity<List<TicketDto>> listSupport(
            @RequestParam(required = false) SupportStatus status,
            @RequestParam(required = false, defaultValue = "100") int limit) {
        return ResponseEntity.ok(supportService.listForAdmin(status, limit));
    }

    @Operation(summary = "Destek bileti durumunu güncelle (admin notu opsiyonel)")
    @PutMapping("/support/{id}/status")
    public ResponseEntity<TicketDto> updateSupportStatus(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long id,
            @Valid @RequestBody UpdateStatusRequest request) {
        return ResponseEntity.ok(
                supportService.updateStatus(id, currentUser.getId(),
                        request.getStatus(), request.getAdminNote()));
    }

    // ================================================================
    // FAZ G.3 — Isletme dogrulama (KYC onay rozeti)
    // ================================================================

    @Operation(summary = "İşletmeleri listele (verifiedOnly opsiyonel: true/false/null)")
    @GetMapping("/businesses")
    public ResponseEntity<List<AdminService.AdminBusinessDto>> listBusinesses(
            @RequestParam(required = false) Boolean verified,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(adminService.listBusinessesForAdmin(verified, search));
    }

    @Operation(summary = "İşletme doğrulamasını aç/kapat (toggle)")
    @PutMapping("/businesses/{id}/verify")
    public ResponseEntity<AdminService.AdminBusinessDto> setBusinessVerified(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long id,
            @RequestParam boolean verified) {
        AdminService.AdminBusinessDto result = adminService.setBusinessVerified(id, verified, currentUser.getId());
        outboxService.appendAuditLog(AuditLoggedEvent.user(currentUser.getId(),
                verified ? "BUSINESS_VERIFY" : "BUSINESS_UNVERIFY", "BUSINESS", id,
                "İşletme " + result.getName() + " → " + (verified ? "doğrulandı" : "doğrulama kaldırıldı")));
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "İlanı askıya al / aktive et (PAUSED veya ACTIVE)")
    @PutMapping("/listings/{id}/status")
    public ResponseEntity<AdminService.AdminListingDto> setListingStatus(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long id,
            @Valid @RequestBody AdminService.SetListingStatusRequest request) {
        AdminService.AdminListingDto result = adminService.setListingStatus(id, request.getStatus());
        outboxService.appendAuditLog(AuditLoggedEvent.user(currentUser.getId(),
            "LISTING_" + request.getStatus().name(), "LISTING", id,
            "İlan durumu: " + request.getStatus().name() + " (" + result.getTitle() + ")"));
        return ResponseEntity.ok(result);
    }
}
