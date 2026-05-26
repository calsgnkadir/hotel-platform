package com.hotelapp.controller;

import com.hotelapp.enums.Role;
import com.hotelapp.service.AdminService;
import com.hotelapp.service.AdminService.BanRequest;
import com.hotelapp.service.AdminService.StatsDto;
import com.hotelapp.service.AdminService.StudentStatusRequest;
import com.hotelapp.service.AdminService.UserDetail;
import com.hotelapp.service.AdminService.UserSummary;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
            @PathVariable Long id,
            @Valid @RequestBody BanRequest request) {
        return ResponseEntity.ok(adminService.ban(id, request.getDays()));
    }

    @Operation(summary = "Banı kaldır")
    @PutMapping("/users/{id}/unban")
    public ResponseEntity<UserSummary> unban(@PathVariable Long id) {
        return ResponseEntity.ok(adminService.unban(id));
    }

    @Operation(summary = "Platform istatistikleri")
    @GetMapping("/stats")
    public ResponseEntity<StatsDto> getStats() {
        return ResponseEntity.ok(adminService.getStats());
    }
}
