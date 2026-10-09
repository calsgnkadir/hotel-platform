package com.hotelapp.controller;

import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.CandidateBlockService;
import com.hotelapp.service.CandidateBlockService.BlockedCandidateDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Isletme adayi engeller.
 * - POST   /api/business/blocked-candidates/{candidateId} -> 204 (idempotent)
 * - DELETE /api/business/blocked-candidates/{candidateId} -> 204 (idempotent)
 * - GET    /api/business/blocked-candidates               -> engelledigim adaylar
 * Sahiplik serviste: islem her zaman cagiranin kendi isletmesi uzerinde yapilir.
 */
@RestController
@RequestMapping("/api/business/blocked-candidates")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "12b. Engellenen Adaylar", description = "Isletmenin aday engelleme islemleri")
public class CandidateBlockController {

    private final CandidateBlockService blockService;

    @Operation(summary = "Adayi engelle (idempotent; aktif basvurulari reddedilir)")
    @PostMapping("/{candidateId}")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    public ResponseEntity<Void> block(
            @PathVariable Long candidateId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        blockService.block(currentUser.getId(), candidateId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Aday engelini kaldir (idempotent)")
    @DeleteMapping("/{candidateId}")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    public ResponseEntity<Void> unblock(
            @PathVariable Long candidateId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        blockService.unblock(currentUser.getId(), candidateId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Engelledigim adaylar (en yeni ustte)")
    @GetMapping
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    public ResponseEntity<List<BlockedCandidateDto>> list(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(blockService.listBlocked(currentUser.getId()));
    }
}
