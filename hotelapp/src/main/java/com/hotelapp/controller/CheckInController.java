package com.hotelapp.controller;

import com.hotelapp.service.CheckInService;
import com.hotelapp.service.CheckInService.AttendanceDto;
import com.hotelapp.service.CheckInService.PassDto;
import com.hotelapp.service.CheckInService.ScanResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "B. İşletme", description = "Giriş kartı (kişisel, tek kullanımlık QR) + yoklama")
public class CheckInController {

    private final CheckInService checkInService;

    @Operation(summary = "Çalışan: bugünkü giriş kartlarım (vardiya başına kişisel QR)")
    @GetMapping("/api/candidate/passes")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<PassDto>> myPasses(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        return ResponseEntity.ok(checkInService.myPasses(currentUser.getId()));
    }

    @Operation(summary = "Görevli (işletme hesabı): çalışanın giriş kartını okut — tek kullanımlık")
    @PostMapping("/api/business/passes/{token}/scan")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ScanResult> scan(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable String token) {
        return ResponseEntity.ok(checkInService.scan(token, currentUser.getId()));
    }

    @Operation(summary = "Yoklama ekranı: beklenen/gelen listesi")
    @GetMapping("/api/business/listings/{listingId}/attendance")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<AttendanceDto> attendance(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long listingId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(checkInService.attendance(listingId, currentUser.getId(), date));
    }

    @Operation(summary = "İşletme: çalışanı elle 'geldi' işaretle (telefonu yoksa)")
    @PostMapping("/api/business/applications/{applicationId}/manual-checkin")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> manualCheckIn(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long applicationId) {
        checkInService.manualCheckIn(applicationId, currentUser.getId());
        return ResponseEntity.noContent().build();
    }
}
