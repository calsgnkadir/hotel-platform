package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.service.FavoriteService;
import com.hotelapp.service.FavoriteService.FavoriteDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * FAZ 2/#32 — Talent pool / Favoriler.
 */
@RestController
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "12. Favoriler (Talent Pool)", description = "Isletme talent pool yonetimi")
public class FavoriteController {

    private final FavoriteService favoriteService;

    @Operation(summary = "Adayi favorilere ekle (idempotent)")
    @PostMapping("/api/business/favorites/{candidateId}")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    public ResponseEntity<FavoriteDto> addFavorite(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long candidateId,
            @RequestBody(required = false) FavoriteNoteDto body) {
        String note = body != null ? body.getNote() : null;
        return ResponseEntity.ok(favoriteService.addFavorite(currentUser.getId(), candidateId, note));
    }

    @Operation(summary = "Adayi favorilerden kaldir")
    @DeleteMapping("/api/business/favorites/{candidateId}")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    public ResponseEntity<Void> removeFavorite(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long candidateId) {
        favoriteService.removeFavorite(currentUser.getId(), candidateId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Tum favori adaylarimi listele")
    @GetMapping("/api/business/favorites")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    public ResponseEntity<List<FavoriteDto>> listFavorites(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(favoriteService.listFavorites(currentUser.getId()));
    }

    @Operation(summary = "Bir aday favorimde mi?")
    @GetMapping("/api/business/favorites/{candidateId}/check")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    public ResponseEntity<Map<String, Boolean>> isFavorite(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long candidateId) {
        return ResponseEntity.ok(Map.of("favorited",
                favoriteService.isFavorited(currentUser.getId(), candidateId)));
    }

    @Operation(summary = "Aday: kac isletme tarafindan favorilenmisim? (motivasyon)")
    @GetMapping("/api/candidate/favorited-count")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Map<String, Long>> getMyFavoritedCount(@AuthenticationPrincipal User currentUser) {
        long count = currentUser != null ? favoriteService.countFavoritedBy(currentUser.getId()) : 0L;
        Map<String, Long> body = new java.util.HashMap<>();
        body.put("count", count);  // Map.of null kabul etmez, HashMap kullaniyoruz (defensive)
        return ResponseEntity.ok(body);
    }

    @Data
    public static class FavoriteNoteDto {
        private String note;
    }
}
