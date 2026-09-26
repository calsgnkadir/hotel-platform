package com.hotelapp.controller;

import com.hotelapp.service.CheckInService;
import com.hotelapp.service.CheckInService.AttendanceDto;
import com.hotelapp.service.CheckInService.CheckInResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequiredArgsConstructor
@Tag(name = "B. İşletme", description = "Toplu vardiya yoklaması (QR)")
public class CheckInController {

    private final CheckInService checkInService;

    @Operation(summary = "Yoklama ekranı: günün QR linki + beklenen/gelen listesi")
    @GetMapping("/api/business/listings/{listingId}/attendance")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<AttendanceDto> attendance(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long listingId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(checkInService.attendance(listingId, currentUser.getId(), date));
    }

    @Operation(summary = "Ekip başı: adayı elle 'geldi' işaretle (telefonu yoksa)")
    @PostMapping("/api/business/applications/{applicationId}/manual-checkin")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> manualCheckIn(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long applicationId) {
        checkInService.manualCheckIn(applicationId, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Aday: toplanma noktasındaki QR'ı okutarak giriş yap")
    @PostMapping("/api/candidate/checkin")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<CheckInResult> checkIn(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @Valid @RequestBody CheckInBody body) {
        return ResponseEntity.ok(checkInService.checkIn(body.token(), currentUser.getId()));
    }

    public record CheckInBody(@NotBlank String token) {}
}
