package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.service.WorkSessionService;
import com.hotelapp.service.WorkSessionService.WorkSessionDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * FAZ 2/#21 — Geo-fenced clock-in/out endpoint'leri.
 */
@RestController
@RequestMapping("/api/candidate/work-sessions")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "13. Mesai Takibi (GPS)", description = "Geo-fenced clock-in/out — FAZ 2/#21")
@PreAuthorize("hasRole('CANDIDATE')")
public class WorkSessionController {

    private final WorkSessionService workSessionService;

    @Operation(summary = "Mesaiye basla — GPS koordinati ile (200m fence)")
    @PostMapping("/{applicationId}/clock-in")
    public ResponseEntity<WorkSessionDto> clockIn(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long applicationId,
            @org.springframework.web.bind.annotation.RequestBody GeoBody body) {
        return ResponseEntity.ok(workSessionService.clockIn(
                currentUser.getId(), applicationId, body.getLat(), body.getLng()));
    }

    @Operation(summary = "Mesaiyi bitir — GPS koordinati ile")
    @PostMapping("/{applicationId}/clock-out")
    public ResponseEntity<WorkSessionDto> clockOut(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long applicationId,
            @org.springframework.web.bind.annotation.RequestBody GeoBody body) {
        return ResponseEntity.ok(workSessionService.clockOut(
                currentUser.getId(), applicationId, body.getLat(), body.getLng()));
    }

    @Operation(summary = "Acik (henuz bitmemis) mesai var mi?")
    @GetMapping("/{applicationId}/active")
    public ResponseEntity<WorkSessionDto> getActive(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long applicationId) {
        WorkSessionDto active = workSessionService.getActiveSession(currentUser.getId(), applicationId);
        return active != null ? ResponseEntity.ok(active) : ResponseEntity.noContent().build();
    }

    @Operation(summary = "Bir basvurunun tum mesai kayitlari (gecmis)")
    @GetMapping("/{applicationId}")
    public ResponseEntity<List<WorkSessionDto>> list(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long applicationId) {
        return ResponseEntity.ok(workSessionService.listForApplication(applicationId, currentUser.getId()));
    }

    @Data
    public static class GeoBody {
        @NotNull private BigDecimal lat;
        @NotNull private BigDecimal lng;
    }
}
