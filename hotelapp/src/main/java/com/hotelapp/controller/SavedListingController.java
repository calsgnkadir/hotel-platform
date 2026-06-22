package com.hotelapp.controller;

import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.JobListingService;
import com.hotelapp.service.JobListingService.ListingResponse;
import com.hotelapp.service.SavedListingService;
// ListingResponse JobListingService icindeki inner class
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
 * Dalga H1 — Aday'in favori (saved) ilanlari endpoint'i
 *
 * - POST   /api/saved-listings/{listingId}  -> kaydet (idempotent)
 * - DELETE /api/saved-listings/{listingId}  -> kaldir
 * - GET    /api/saved-listings/my           -> kaydettiklerim listesi
 */
@RestController
@RequestMapping("/api/saved-listings")
@RequiredArgsConstructor
@Tag(name = "12. Kaydettiklerim", description = "Aday'in favori ilanlari")
public class SavedListingController {

    private final SavedListingService savedListingService;
    private final JobListingService jobListingService;

    @Operation(summary = "Ilani kaydet (favori)")
    @PostMapping("/{listingId}")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> save(
            @PathVariable Long listingId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        savedListingService.save(currentUser.getId(), listingId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Ilani kaydettiklerimden cikar")
    @DeleteMapping("/{listingId}")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> unsave(
            @PathVariable Long listingId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        savedListingService.unsave(currentUser.getId(), listingId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Kaydettiklerim listesi")
    @GetMapping("/my")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<ListingResponse>> getMy(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        // SavedListing -> JobListing -> Response DTO
        var listings = savedListingService.getMySavedListings(currentUser.getId());
        var dtos = listings.stream()
                .map(l -> jobListingService.getListingById(l.getId()))
                .toList();
        return ResponseEntity.ok(dtos);
    }
}
