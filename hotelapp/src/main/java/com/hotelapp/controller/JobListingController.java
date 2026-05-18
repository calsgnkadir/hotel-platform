package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Shift;
import com.hotelapp.service.JobListingService;
import com.hotelapp.service.JobListingService.ListingRequest;
import com.hotelapp.service.JobListingService.ListingResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/listings")
@RequiredArgsConstructor
@Tag(name = "6. İlanlar", description = "İş ilanları — listeleme herkese açık, yönetim BUSINESS_OWNER'a özel")
public class JobListingController {

    private final JobListingService jobListingService;

    @Operation(
            summary = "Aktif ilanları listele",
            description = "Tüm parametreler opsiyonel. shifts çoklu (MORNING,EVENING,NIGHT), keyword başlıkta arar."
    )
    @GetMapping
    public ResponseEntity<List<ListingResponse>> listActiveListings(
            @RequestParam(required = false) Position position,
            @RequestParam(required = false) JobType jobType,
            @RequestParam(required = false) List<Shift> shifts,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) BigDecimal minSalary,
            @RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(
                jobListingService.getActiveListings(position, jobType, shifts, district, minSalary, keyword));
    }

    @Operation(summary = "Kendi ilanlarımı listele — sadece BUSINESS_OWNER")
    @GetMapping("/my")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<ListingResponse>> myListings(
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(jobListingService.getMyListings(currentUser.getId()));
    }

    @Operation(summary = "Yeni ilan oluştur — sadece BUSINESS_OWNER")
    @PostMapping
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingResponse> createListing(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody ListingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(jobListingService.createListing(currentUser.getId(), request));
    }

    @Operation(summary = "İlan durumunu değiştir — sadece BUSINESS_OWNER")
    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingResponse> updateStatus(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @RequestParam ListingStatus status) {
        return ResponseEntity.ok(jobListingService.updateStatus(id, currentUser.getId(), status));
    }

    @Operation(summary = "Tek ilan detayı — herhangi bir authenticated kullanıcı")
    @GetMapping("/{id}")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingResponse> getListing(@PathVariable Long id) {
        return ResponseEntity.ok(jobListingService.getListingById(id));
    }

    @Operation(summary = "İlanı düzenle — sadece BUSINESS_OWNER (sahibi)")
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingResponse> updateListing(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id,
            @Valid @RequestBody ListingRequest request) {
        return ResponseEntity.ok(jobListingService.updateListing(id, currentUser.getId(), request));
    }
}
