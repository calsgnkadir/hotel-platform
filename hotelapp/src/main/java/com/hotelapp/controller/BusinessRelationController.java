package com.hotelapp.controller;

import com.hotelapp.entity.Business;
import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.BusinessRelationService;
import com.hotelapp.service.BusinessRelationService.RelationStats;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Dalga I1 — Aday'in takip ettigi / engelledigi isletmeler endpoint'i
 *
 * Kariyer.net pattern:
 * - POST   /api/business-relations/{businessId}/follow
 * - DELETE /api/business-relations/{businessId}/follow
 * - POST   /api/business-relations/{businessId}/block
 * - DELETE /api/business-relations/{businessId}/block
 * - GET    /api/business-relations/following  -> takip ettiklerim listesi
 * - GET    /api/business-relations/blocked    -> engelledigim listesi
 * - GET    /api/business-relations/stats      -> {followingCount, blockedCount}
 */
@RestController
@RequestMapping("/api/business-relations")
@RequiredArgsConstructor
@Tag(name = "13. Isletme Iliskileri", description = "Aday'in takip/engelleme islemleri")
public class BusinessRelationController {

    private final BusinessRelationService relationService;

    // ----- FOLLOW -----

    @Operation(summary = "Isletmeyi takip et (idempotent; engelliyse engeli kaldirir)")
    @PostMapping("/{businessId}/follow")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> follow(
            @PathVariable Long businessId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        relationService.follow(currentUser.getId(), businessId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Takipten cikar")
    @DeleteMapping("/{businessId}/follow")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> unfollow(
            @PathVariable Long businessId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        relationService.unfollow(currentUser.getId(), businessId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Takip ettigim isletmeler")
    @GetMapping("/following")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<Map<String, Object>>> getFollowing(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(toLite(relationService.getMyFollowing(currentUser.getId())));
    }

    // ----- BLOCK -----

    @Operation(summary = "Isletmeyi engelle (idempotent; takip ediyorsa takipten cikartir)")
    @PostMapping("/{businessId}/block")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> block(
            @PathVariable Long businessId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        relationService.block(currentUser.getId(), businessId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Engeli kaldir")
    @DeleteMapping("/{businessId}/block")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> unblock(
            @PathVariable Long businessId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        relationService.unblock(currentUser.getId(), businessId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Engelledigim isletmeler")
    @GetMapping("/blocked")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<Map<String, Object>>> getBlocked(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(toLite(relationService.getMyBlocked(currentUser.getId())));
    }

    @Operation(summary = "Takip + engel sayilarim")
    @GetMapping("/stats")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<RelationStats> getStats(@AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(relationService.getStats(currentUser.getId()));
    }

    /** Lite DTO — isletme kart icin yeterli (id+ad+type+logo+ilce) */
    private List<Map<String, Object>> toLite(List<Business> list) {
        return list.stream()
                .<Map<String, Object>>map(b -> Map.of(
                        "id", b.getId(),
                        "name", b.getName() != null ? b.getName() : "",
                        "type", b.getType() != null ? b.getType().name() : "",
                        "district", b.getDistrict() != null ? b.getDistrict() : ""
                ))
                .toList();
    }
}
