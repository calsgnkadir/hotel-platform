package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Shift;
import com.hotelapp.service.JobListingQueryService;
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
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;

@RestController
@RequestMapping("/api/listings")
@RequiredArgsConstructor
@Tag(name = "6. İlanlar", description = "İş ilanları — listeleme herkese açık, yönetim BUSINESS_OWNER'a özel")
public class JobListingController {

    private final JobListingService jobListingService;
    private final JobListingQueryService jobListingQueryService;

    @Operation(
            summary = "Aktif ilanları listele",
            description = "Tüm parametreler opsiyonel. shifts çoklu (MORNING,EVENING,NIGHT), keyword başlıkta arar. dateFrom/dateTo YYYY-MM-DD formatında. ranked=true: aday tercihlerine göre 'sana özel' sıralama (sadece authenticated)."
    )
    @GetMapping
    public ResponseEntity<List<ListingResponse>> listActiveListings(
            @RequestParam(required = false) Position position,
            @RequestParam(required = false) JobType jobType,
            @RequestParam(required = false) List<Shift> shifts,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) BigDecimal minSalary,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false, defaultValue = "false") boolean ranked,
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        if (ranked && currentUser != null) {
            return ResponseEntity.ok(
                    jobListingQueryService.getActiveListingsRanked(
                            currentUser.getId(),
                            position, jobType, shifts, district, minSalary, keyword, dateFrom, dateTo));
        }
        return ResponseEntity.ok(
                jobListingQueryService.getActiveListings(position, jobType, shifts, district, minSalary, keyword, dateFrom, dateTo));
    }

    @Operation(summary = "Kendi ilanlarımı listele — sadece BUSINESS_OWNER")
    @GetMapping("/my")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<ListingResponse>> myListings(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        return ResponseEntity.ok(jobListingQueryService.getMyListings(currentUser.getId()));
    }

    @Operation(summary = "Yeni ilan oluştur — sadece BUSINESS_OWNER")
    @PostMapping
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingResponse> createListing(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @Valid @RequestBody ListingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(jobListingService.createListing(currentUser.getId(), request));
    }

    @Operation(summary = "İlan durumunu değiştir — sadece BUSINESS_OWNER")
    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingResponse> updateStatus(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long id,
            @RequestParam ListingStatus status) {
        return ResponseEntity.ok(jobListingService.updateStatus(id, currentUser.getId(), status));
    }

    @Operation(summary = "Tek ilan detayı — herhangi bir authenticated kullanıcı")
    @GetMapping("/{id}")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingResponse> getListing(@PathVariable Long id) {
        return ResponseEntity.ok(jobListingQueryService.getListingById(id));
    }

    @Operation(
            summary = "FAZ 16 — Benzer ilanlar (content-based)",
            description = "Bu ilana benzer aktif ilanlar: pozisyon + ilçe/komşu + çalışma türü + maaş yakınlığı. Public.")
    @GetMapping("/{id}/similar")
    public ResponseEntity<List<ListingResponse>> similarListings(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "6") int limit) {
        return ResponseEntity.ok(jobListingQueryService.getSimilarListings(id, Math.min(limit, 12)));
    }

    @Operation(summary = "İlanı düzenle — sadece BUSINESS_OWNER (sahibi)")
    @PutMapping("/{id}")
    // FAZ 4.9 — Method-level: bu ilan gerçekten benim mi?
    @PreAuthorize("hasRole('BUSINESS_OWNER') and @securityChecks.isListingOwner(#p1)")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ListingResponse> updateListing(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long id,
            @Valid @RequestBody ListingRequest request) {
        return ResponseEntity.ok(jobListingService.updateListing(id, currentUser.getId(), request));
    }

    // ----------------------------------------------------------------
    // Dalga 4
    // ----------------------------------------------------------------

    @Operation(summary = "İlan goruntulenme sayisini +1 artir (anonim trafik dahil)")
    @PostMapping("/{id}/view")
    public ResponseEntity<Void> trackView(@PathVariable Long id) {
        jobListingService.trackView(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Pozisyon icin maas benchmark (AVG/MIN/MAX) — Glassdoor pattern")
    @GetMapping("/salary-benchmark")
    public ResponseEntity<JobListingService.SalaryBenchmarkResponse> salaryBenchmark(
            @RequestParam Position position) {
        return ResponseEntity.ok(jobListingService.getSalaryBenchmark(position));
    }
}
