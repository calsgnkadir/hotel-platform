package com.hotelapp.controller;

import com.hotelapp.service.CheckInService;
import com.hotelapp.service.CheckInService.AttendanceDto;
import com.hotelapp.service.CheckInService.CheckInResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "B. İşletme", description = "Giriş yoklaması (kalıcı QR)")
public class CheckInController {

    private final CheckInService checkInService;

    @Operation(summary = "Yoklama ekranı: işletmenin kalıcı giriş QR'ı + beklenen/gelen listesi")
    @GetMapping("/api/business/listings/{listingId}/attendance")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<AttendanceDto> attendance(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long listingId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(checkInService.attendance(listingId, currentUser.getId(), date));
    }

    @Operation(summary = "İşletme: adayı elle 'geldi' işaretle (telefonu yoksa)")
    @PostMapping("/api/business/applications/{applicationId}/manual-checkin")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> manualCheckIn(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long applicationId) {
        checkInService.manualCheckIn(applicationId, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Aday (girişli): QR okutunca bugünkü vardiyasına giriş")
    @PostMapping("/api/candidate/checkin")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<CheckInResult> checkIn(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @Valid @RequestBody CheckInBody body) {
        return ResponseEntity.ok(checkInService.checkIn(body.token(), currentUser.getId()));
    }

    @Operation(summary = "QR sayfası: hangi işletme (herkese açık, sadece ad)")
    @GetMapping("/api/public/checkin/{token}")
    public ResponseEntity<Map<String, String>> checkInInfo(@PathVariable String token) {
        return ResponseEntity.ok(Map.of("businessName", checkInService.businessNameFor(token)));
    }

    @Operation(summary = "Hesapsız giriş: ad soyad bugünün listesinde varsa giriş yazılır")
    @PostMapping("/api/public/checkin/{token}")
    public ResponseEntity<CheckInResult> checkInByName(
            @PathVariable String token, @Valid @RequestBody NameCheckInBody body) {
        return ResponseEntity.ok(checkInService.checkInByName(token, body.fullName(), body.phoneLast4()));
    }

    public record CheckInBody(@NotBlank String token) {}
    public record NameCheckInBody(@NotBlank @Size(max = 100) String fullName, @Size(max = 8) String phoneLast4) {}
}
