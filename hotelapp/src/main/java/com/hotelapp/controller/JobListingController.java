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
import com.hotelapp.service.UrgentService;              // FAZ C.2
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
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
    private final UrgentService urgentService;   // FAZ C.2

    /** Sunucu tarafi sayfalama: istemci istese de tek sorguda tavani asamaz. */
    private static final int DEFAULT_PAGE_SIZE = 60;
    private static final int MAX_PAGE_SIZE     = 100;

    private static Pageable pageable(int page, int size, Sort sort) {
        int safeSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);
        return PageRequest.of(safePage, safeSize, sort);
    }

    @Operation(
            summary = "Aktif ilanları listele (sayfalı)",
            description = "Tüm filtre parametreleri opsiyonel. shifts çoklu (MORNING,EVENING,NIGHT), keyword başlıkta arar. dateFrom/dateTo YYYY-MM-DD. ranked=true: aday tercihlerine göre 'sana özel' sıralama (sadece authenticated). page (0'dan başlar) + size (varsayılan 60, en fazla 100) ile sayfalanır; Page zarfı döner."
    )
    @GetMapping
    public ResponseEntity<Page<ListingResponse>> listActiveListings(
            @RequestParam(required = false) Position position,
            @RequestParam(required = false) JobType jobType,
            @RequestParam(required = false) List<Shift> shifts,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) BigDecimal minSalary,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false, defaultValue = "false") boolean ranked,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size,
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        Pageable pageable = pageable(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        if (ranked && currentUser != null) {
            return ResponseEntity.ok(
                    jobListingQueryService.getActiveListingsRanked(
                            currentUser.getId(),
                            position, jobType, shifts, district, minSalary, keyword, dateFrom, dateTo, pageable));
        }
        return ResponseEntity.ok(
                jobListingQueryService.getActiveListings(
                        position, jobType, shifts, district, minSalary, keyword, dateFrom, dateTo, pageable));
    }

    @Operation(summary = "Kendi ilanlarımı listele (sayfalı) — sadece BUSINESS_OWNER")
    @GetMapping("/my")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Page<ListingResponse>> myListings(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size,
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        Pageable pageable = pageable(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(jobListingQueryService.getMyListings(currentUser.getId(), pageable));
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

    // ============================================================
    // FAZ C.2 — Acil ilan
    // ============================================================

    @Operation(
            summary = "FAZ C.2: İlanı ACİL işaretle / acilliğini kaldır — sadece BUSINESS_OWNER",
            description = "Acile alındığında o an 'hemen müsait' olan ve pozisyonu tutan adaylara "
                    + "anında bildirim + web push gider. Acillik, en yakın vardiyanın bitişinde "
                    + "(vardiya yoksa 24 saat sonra) kendiliğinden söner."
    )
    @PutMapping("/{id}/urgent")
    @PreAuthorize("hasRole('BUSINESS_OWNER') and @securityChecks.isListingOwner(#p1)")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<UrgentService.UrgentResult> setUrgent(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long id,
            @RequestParam(defaultValue = "true") boolean urgent) {
        return ResponseEntity.ok(urgentService.setUrgent(id, currentUser.getId(), urgent));
    }

    @Operation(summary = "FAZ C.2: Şu an 'hemen müsait' aday sayısı — BUSINESS_OWNER")
    @GetMapping("/available-now-count")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<java.util.Map<String, Long>> availableNowCount() {
        return ResponseEntity.ok(java.util.Map.of("count", urgentService.availableNowCount()));
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
