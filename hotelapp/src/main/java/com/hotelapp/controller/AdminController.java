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
import com.hotelapp.entity.User;
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
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody UpdateReportStatusRequest request) {
        ReportDto result = reportService.updateStatus(id, request.getStatus(), request.getAdminNote());
        auditLogService.log(currentUser.getId(),
                request.getStatus().name().equals("RESOLVED") ? "RESOLVE_REPORT" : "DISMISS_REPORT",
                "REPORT", id,
                "Şikayet #" + id + " → " + request.getStatus());
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
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody BanRequest request) {
        UserSummary result = adminService.ban(id, request.getDays());
        auditLogService.log(currentUser.getId(), "BAN_USER", "USER", id,
                request.getDays() + " gün ban (" + result.getEmail() + ")");
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Banı kaldır")
    @PutMapping("/users/{id}/unban")
    public ResponseEntity<UserSummary> unban(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        UserSummary result = adminService.unban(id);
        auditLogService.log(currentUser.getId(), "UNBAN_USER", "USER", id,
                "Ban kaldırıldı (" + result.getEmail() + ")");
        return ResponseEntity.ok(result);
    }

    @Operation(summary = "Platform istatistikleri")
    @GetMapping("/stats")
    public ResponseEntity<StatsDto> getStats() {
        return ResponseEntity.ok(adminService.getStats());
    }
}
