package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.SalaryType;
import com.hotelapp.enums.Shift;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.JobListingRepository;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class JobListingService {

    private final JobListingRepository jobListingRepository;
    private final BusinessRepository businessRepository;
    private final com.hotelapp.repository.UserRepository userRepository;
    private final ReviewService reviewService;
    private final NotificationService notificationService;
    private final com.hotelapp.repository.BusinessPhotoRepository businessPhotoRepository;  // D3
    private final FileStorageService fileStorageService;                                     // D3
    private final com.hotelapp.repository.UserAvailabilityBlockRepository availabilityBlockRepository;  // J2 müsaitlik filtre

    // ----------------------------------------------------------------
    // Public: browse active listings (dynamic filtering via Specification)
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<ListingResponse> getActiveListings(
            Position position,
            JobType jobType,
            List<Shift> shifts,
            String district,
            BigDecimal minSalary,
            String keyword,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        Specification<JobListing> spec = buildActiveListingSpec(
                position, jobType, shifts, district, minSalary, keyword, dateFrom, dateTo);
        return toResponses(jobListingRepository.findAll(spec));
    }

    private Specification<JobListing> buildActiveListingSpec(
            Position position,
            JobType jobType,
            List<Shift> shifts,
            String district,
            BigDecimal minSalary,
            String keyword,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // Her zaman: sadece ACTIVE ilanlar
            predicates.add(cb.equal(root.get("status"), ListingStatus.ACTIVE));

            if (position != null) {
                predicates.add(cb.equal(root.get("position"), position));
            }
            if (jobType != null) {
                predicates.add(cb.equal(root.get("jobType"), jobType));
            }
            if (shifts != null && !shifts.isEmpty()) {
                predicates.add(root.get("shift").in(shifts));
            }
            if (district != null && !district.isBlank()) {
                Join<JobListing, Business> bizJoin = root.join("business");
                predicates.add(cb.equal(bizJoin.get("district"), district));
            }
            if (minSalary != null) {
                // salaryMin set edilmiş VE filtreden büyük/eşit olmalı (null'lar dışarıda kalır)
                predicates.add(cb.greaterThanOrEqualTo(root.get("salaryMin"), minSalary));
            }
            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.toLowerCase() + "%";
                predicates.add(cb.like(cb.lower(root.get("title")), pattern));
            }

            // Faz E4: Tarih filtresi — ilanın en az 1 slotu verilen aralıkta olmalı.
            // DISTINCT zorunlu çünkü JOIN sonucu duplicate üretir.
            if (dateFrom != null || dateTo != null) {
                query.distinct(true);
                Join<JobListing, com.hotelapp.entity.ShiftSlot> slotJoin = root.join("shiftSlots");
                if (dateFrom != null) {
                    predicates.add(cb.greaterThanOrEqualTo(slotJoin.get("date"), dateFrom));
                }
                if (dateTo != null) {
                    predicates.add(cb.lessThanOrEqualTo(slotJoin.get("date"), dateTo));
                }
            }

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    // ----------------------------------------------------------------
    // Business owner: list own listings
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<ListingResponse> getMyListings(Long ownerId) {
        return toResponses(jobListingRepository.findAllByBusiness_OwnerId(ownerId));
    }

    // ----------------------------------------------------------------
    // Business owner: create listing
    // ----------------------------------------------------------------
    @Transactional
    public ListingResponse createListing(Long ownerId, ListingRequest request) {
        Business business = businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new BusinessRuleException("İşletme profili bulunamadı. Önce kaydolun."));

        validateDates(request);
        validateSlots(request.getShiftSlots());

        JobListing listing = JobListing.builder()
                .business(business)
                .position(request.getPosition())
                .jobType(request.getJobType())
                .title(request.getTitle())
                .description(request.getDescription())
                .requirements(request.getRequirements())
                .salaryMin(request.getSalaryMin())
                .salaryMax(request.getSalaryMax())
                .salaryType(request.getSalaryType())     // FAZ 2/#25
                .tipsIncluded(request.getTipsIncluded()) // FAZ 2/#25
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .shiftStart(request.getShiftStart())
                .shiftEnd(request.getShiftEnd())
                .shift(request.getShift())
                .build();

        // Slotları ilana bağla
        if (request.getShiftSlots() != null) {
            for (ShiftSlotCreate s : request.getShiftSlots()) {
                ShiftSlot slot = ShiftSlot.builder()
                        .jobListing(listing)
                        .date(s.getDate())
                        .startTime(s.getStartTime())
                        .endTime(s.getEndTime())
                        .slotsNeeded(s.getSlotsNeeded() == null ? 1 : s.getSlotsNeeded())
                        .slotsFilled(0)
                        .build();
                listing.getShiftSlots().add(slot);
            }
        }

        jobListingRepository.save(listing);

        // ADIM J: Tercihleri eşleşen adaylara "İlgini çekebilir" bildirimi
        notifyMatchingCandidates(listing);

        return toResponse(listing);
    }

    /**
     * ADIM J: İlanın ilçe + pozisyonuyla eşleşen aday tercihleri varsa bildirim at.
     * Tercih boş (opt-out) olan adaylar bildirilmez.
     */
    private void notifyMatchingCandidates(JobListing listing) {
        try {
            String district = listing.getBusiness().getDistrict();
            if (district == null || district.isBlank()) {
                log.info("[MATCH] Listing #{} — Business district BOŞ, eşleştirme atlanıyor (businessId={})",
                        listing.getId(), listing.getBusiness().getId());
                return;
            }

            // Iki opt-in kanali: (1) district+position tercihi (klasik), (2) musaitlik blogu tanimlamis
            var prefMatched = userRepository.findCandidatesMatchingPreferences(district, listing.getPosition());
            var availOptIn  = userRepository.findCandidatesWithAvailabilityBlocks();
            // Set ile birlestir (duplicate adayi onle)
            java.util.Map<Long, com.hotelapp.entity.User> matching = new java.util.LinkedHashMap<>();
            for (var u : prefMatched) matching.put(u.getId(), u);
            for (var u : availOptIn)  matching.putIfAbsent(u.getId(), u);

            log.info("[MATCH] Listing #{} — district='{}', position={}, pref-eşleşen={}, avail-blok={}, toplam aday={}",
                    listing.getId(), district, listing.getPosition(),
                    prefMatched.size(), availOptIn.size(), matching.size());

            String posLabel = listing.getPosition().name();
            int notifiedCount = 0, skippedNoFit = 0;
            for (var aday : matching.values()) {
                // FAZ J2 ext: aday haftalık müsaitlik bloğu tanımladıysa, ilan
                // slot'larından en az biri bloğunun içine düşmeli. Hiç blok yoksa
                // opt-out: her ilana açık (eski davranış).
                if (!candidateFitsListingSlots(aday.getId(), listing)) {
                    skippedNoFit++;
                    continue;
                }
                log.info("[MATCH]   -> Bildirim atılıyor: candidateId={}, email={}",
                        aday.getId(), aday.getEmail());
                notificationService.notify(aday.getId(),
                        com.hotelapp.enums.NotificationType.MATCHING_LISTING,
                        "İlgini çekebilir",
                        listing.getBusiness().getName() + " · " + district
                                + " · " + posLabel + " — " + listing.getTitle(),
                        "listings");
                notifiedCount++;
            }
            log.info("[MATCH] Listing #{} — bildirilen={}, müsaitlik uyumsuzlugu={}",
                    listing.getId(), notifiedCount, skippedNoFit);
        } catch (Exception e) {
            // Bildirim hatası ilan oluşturmayı bozmasın
            log.warn("Eşleşen aday bildirimi atılamadı: {}", e.getMessage(), e);
        }
    }

    // ----------------------------------------------------------------
    // Slot validasyonu (Faz E1)
    // - En az 1 slot zorunlu
    // - Her slot: tarih >= bugün, endTime > startTime, slotsNeeded >= 1
    // ----------------------------------------------------------------
    private void validateSlots(List<ShiftSlotCreate> slots) {
        if (slots == null || slots.isEmpty()) {
            throw new BusinessRuleException("İlan için en az 1 vardiya slotu eklemelisiniz");
        }
        LocalDate today = LocalDate.now();
        java.time.LocalTime nowTime = java.time.LocalTime.now();
        for (int i = 0; i < slots.size(); i++) {
            ShiftSlotCreate s = slots.get(i);
            int n = i + 1;
            if (s.getDate() == null)      throw new BusinessRuleException("Slot " + n + ": tarih zorunlu");
            if (s.getStartTime() == null) throw new BusinessRuleException("Slot " + n + ": başlangıç saati zorunlu");
            if (s.getEndTime() == null)   throw new BusinessRuleException("Slot " + n + ": bitiş saati zorunlu");
            if (s.getDate().isBefore(today)) {
                throw new BusinessRuleException("Slot " + n + ": geçmiş tarih olamaz");
            }
            // Bugün için: başlangıç saati şu andan önce olamaz (bugün 22:00'da 08:00 vardiyası anlamsız)
            if (s.getDate().equals(today) && !s.getStartTime().isAfter(nowTime)) {
                throw new BusinessRuleException("Slot " + n + ": bugün için başlangıç saati şu andan sonra olmalı");
            }
            if (!s.getEndTime().isAfter(s.getStartTime())) {
                throw new BusinessRuleException("Slot " + n + ": bitiş saati başlangıçtan sonra olmalı");
            }
            if (s.getSlotsNeeded() != null && s.getSlotsNeeded() < 1) {
                throw new BusinessRuleException("Slot " + n + ": ihtiyaç sayısı en az 1 olmalı");
            }
        }
    }

    // ----------------------------------------------------------------
    // Tarih kuralları (E1 sonrası sadeleştirildi)
    // Scheduling artık shiftSlots üzerinden — startDate/endDate opsiyonel
    // "kontrat dönemi" olarak kullanılır.
    // - Verilirse: bugün veya sonrası olmalı, end >= start
    // ----------------------------------------------------------------
    private void validateDates(ListingRequest req) {
        LocalDate today = LocalDate.now();
        LocalDate start = req.getStartDate();
        LocalDate end   = req.getEndDate();

        if (start != null && start.isBefore(today)) {
            throw new BusinessRuleException("Başlangıç tarihi geçmişte olamaz");
        }
        if (end != null && end.isBefore(today)) {
            throw new BusinessRuleException("Bitiş tarihi geçmişte olamaz");
        }
        if (start != null && end != null && end.isBefore(start)) {
            throw new BusinessRuleException("Bitiş tarihi başlangıçtan önce olamaz");
        }
    }

    // ----------------------------------------------------------------
    // Business owner: update listing status
    // ----------------------------------------------------------------
    @Transactional
    public ListingResponse updateStatus(Long listingId, Long ownerId, ListingStatus status) {
        JobListing listing = getListingForOwner(listingId, ownerId);
        listing.setStatus(status);
        jobListingRepository.save(listing);
        return toResponse(listing);
    }

    // ----------------------------------------------------------------
    // Business owner: full update (title, description, salary, shift, etc.)
    // ----------------------------------------------------------------
    @Transactional
    public ListingResponse updateListing(Long listingId, Long ownerId, ListingRequest request) {
        JobListing listing = getListingForOwner(listingId, ownerId);

        validateDates(request);
        validateSlots(request.getShiftSlots());

        listing.setPosition(request.getPosition());
        listing.setJobType(request.getJobType());
        listing.setShift(request.getShift());
        listing.setTitle(request.getTitle());
        listing.setDescription(request.getDescription());
        listing.setRequirements(request.getRequirements());
        listing.setSalaryMin(request.getSalaryMin());
        listing.setSalaryMax(request.getSalaryMax());
        listing.setSalaryType(request.getSalaryType());     // FAZ 2/#25
        listing.setTipsIncluded(request.getTipsIncluded()); // FAZ 2/#25
        listing.setStartDate(request.getStartDate());
        listing.setEndDate(request.getEndDate());
        listing.setShiftStart(request.getShiftStart());
        listing.setShiftEnd(request.getShiftEnd());

        // Slot diff (orphanRemoval ile uyumlu güvenli desen):
        // 1) Request'te kalmayan slotları çıkar (orphan -> Hibernate siler)
        // 2) Kalan/var olan slotların alanlarını yerinde güncelle
        // 3) ID'siz (yeni) slotları ekle
        // NOT: clear()+addAll() kullanmıyoruz çünkü orphanRemoval ile field güncellemeleri kayboluyor.
        java.util.Set<Long> incomingIds = request.getShiftSlots().stream()
                .map(ShiftSlotCreate::getId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());

        listing.getShiftSlots().removeIf(s -> s.getId() != null && !incomingIds.contains(s.getId()));

        java.util.Map<Long, ShiftSlot> existingById = listing.getShiftSlots().stream()
                .filter(s -> s.getId() != null)
                .collect(java.util.stream.Collectors.toMap(ShiftSlot::getId, s -> s));

        for (ShiftSlotCreate dto : request.getShiftSlots()) {
            if (dto.getId() != null && existingById.containsKey(dto.getId())) {
                // Mevcut slot — alanları yerinde güncelle (slotsFilled korunur)
                ShiftSlot s = existingById.get(dto.getId());
                s.setDate(dto.getDate());
                s.setStartTime(dto.getStartTime());
                s.setEndTime(dto.getEndTime());
                s.setSlotsNeeded(dto.getSlotsNeeded() == null ? 1 : dto.getSlotsNeeded());
            } else {
                // Yeni slot
                ShiftSlot newSlot = ShiftSlot.builder()
                        .jobListing(listing)
                        .date(dto.getDate())
                        .startTime(dto.getStartTime())
                        .endTime(dto.getEndTime())
                        .slotsNeeded(dto.getSlotsNeeded() == null ? 1 : dto.getSlotsNeeded())
                        .slotsFilled(0)
                        .build();
                listing.getShiftSlots().add(newSlot);
            }
        }

        jobListingRepository.save(listing);
        return toResponse(listing);
    }

    // ----------------------------------------------------------------
    // Public: single listing detail (any authenticated user)
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public ListingResponse getListingById(Long id) {
        JobListing listing = jobListingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("İlan", id));
        return toResponse(listing);
    }

    // ----------------------------------------------------------------
    // Helper
    // ----------------------------------------------------------------
    private JobListing getListingForOwner(Long listingId, Long ownerId) {
        JobListing listing = jobListingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("İlan", listingId));
        if (!listing.getBusiness().getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Bu ilan size ait değil");
        }
        return listing;
    }

    /**
     * FAZ N+1 fix: liste toResponse'larini tek seferde bulk fetch ile uretir.
     * Tekli toResponse cagrilari (create/update/single get) eski yolu kullanir.
     *
     * Once tum businessId'leri toplar, sonra:
     *  - ReviewService.getBusinessRatingsBulk -> Map<id, RatingSummary>  (1 sorgu)
     *  - BusinessPhotoRepository.findAllByBusinessIdInOrdered -> tek list (1 sorgu)
     * sonra her listing'i bu map'lerden okuyarak DTO'ya cevirir.
     */
    private List<ListingResponse> toResponses(List<JobListing> listings) {
        if (listings == null || listings.isEmpty()) return java.util.List.of();

        java.util.Set<Long> businessIds = listings.stream()
                .map(l -> l.getBusiness().getId())
                .collect(java.util.stream.Collectors.toSet());

        java.util.Map<Long, com.hotelapp.service.ReviewService.RatingSummary> ratingMap =
                reviewService.getBusinessRatingsBulk(businessIds);

        java.util.Map<Long, List<String>> photosMap = new java.util.HashMap<>();
        for (var photo : businessPhotoRepository.findAllByBusinessIdInOrdered(businessIds)) {
            Long bid = photo.getBusiness().getId();
            var list = photosMap.computeIfAbsent(bid, k -> new java.util.ArrayList<>());
            if (list.size() < 5) {  // ilk 5 yeterli (loadBusinessPhotoUrls ile esleşir)
                String url = fileStorageService.publicUrl(photo.getFilePath());
                if (url != null) list.add(url);
            }
        }

        return listings.stream()
                .map(l -> toResponse(l, ratingMap, photosMap))
                .toList();
    }

    /** Overload — bulk map'leri kullanir (tek tek N+1 yapmaz). */
    private ListingResponse toResponse(JobListing l,
                                       java.util.Map<Long, com.hotelapp.service.ReviewService.RatingSummary> ratingMap,
                                       java.util.Map<Long, List<String>> photosMap) {
        Long bid = l.getBusiness().getId();
        var rating = ratingMap.getOrDefault(bid, com.hotelapp.service.ReviewService.RatingSummary.empty());
        var photos = photosMap.getOrDefault(bid, java.util.List.of());
        return buildResponseFromParts(l, rating.getAverageRating(), rating.getReviewCount(), photos);
    }

    private ListingResponse toResponse(JobListing l) {
        // Tekli: rating + foto sorgulari burada ayri firar (create/update/get single)
        var rating = reviewService.getBusinessRating(l.getBusiness().getId());
        var photos = loadBusinessPhotoUrls(l.getBusiness().getId());
        return buildResponseFromParts(l, rating.getAverageRating(), rating.getReviewCount(), photos);
    }

    /** Ortak DTO insa — hem bulk hem tekli yoldan kullanilir. */
    private ListingResponse buildResponseFromParts(JobListing l,
                                                   Double avgRating, Long reviewCount,
                                                   List<String> photoUrls) {
        List<ShiftSlotDto> slotDtos = l.getShiftSlots() == null ? List.of()
                : l.getShiftSlots().stream()
                    .sorted((a, b) -> {
                        int c = a.getDate().compareTo(b.getDate());
                        return c != 0 ? c : a.getStartTime().compareTo(b.getStartTime());
                    })
                    .map(s -> ShiftSlotDto.builder()
                            .id(s.getId())
                            .date(s.getDate())
                            .startTime(s.getStartTime())
                            .endTime(s.getEndTime())
                            .slotsNeeded(s.getSlotsNeeded())
                            .slotsFilled(s.getSlotsFilled())
                            .full(s.isFull())
                            .build())
                    .toList();

        return ListingResponse.builder()
                .id(l.getId())
                .position(l.getPosition().name())
                .jobType(l.getJobType().name())
                .title(l.getTitle())
                .description(l.getDescription())
                .requirements(l.getRequirements())
                .salaryMin(l.getSalaryMin())
                .salaryMax(l.getSalaryMax())
                .salaryType(l.getSalaryType() != null ? l.getSalaryType().name() : null) // FAZ 2/#25
                .tipsIncluded(l.getTipsIncluded())                                       // FAZ 2/#25
                .startDate(l.getStartDate())
                .endDate(l.getEndDate())
                .shiftStart(l.getShiftStart())
                .shiftEnd(l.getShiftEnd())
                .shift(l.getShift() != null ? l.getShift().name() : null)
                .status(l.getStatus().name())
                .businessId(l.getBusiness().getId())
                .businessName(l.getBusiness().getName())
                .businessType(l.getBusiness().getType().name())
                .businessDistrict(l.getBusiness().getDistrict())
                .businessNeighborhood(l.getBusiness().getNeighborhood())
                .businessAddress(l.getBusiness().getAddress())
                .businessLatitude(l.getBusiness().getLatitude())
                .businessLongitude(l.getBusiness().getLongitude())
                .businessAverageRating(avgRating)
                .businessReviewCount(reviewCount)
                .createdAt(l.getCreatedAt())
                .shiftSlots(slotDtos)
                .businessPhotoUrls(photoUrls)  // D3
                .build();
    }

    /**
     * FAZ J2 ext — Aday'ın haftalık müsaitlik bloklarıyla ilanın vardiya slot'larından
     * en az biri eşleşiyor mu? Aday hiç blok tanımlamamışsa true döner (opt-in mantık).
     *
     * Eşleşme: slot tarihinin haftagünü aday'ın bloğuyla aynı + slot saat aralığı
     * tamamen bloğun içine düşer (b.startTime <= s.startTime AND s.endTime <= b.endTime).
     */
    private boolean candidateFitsListingSlots(Long candidateId, JobListing listing) {
        var blocks = availabilityBlockRepository
                .findByUserIdOrderByDayOfWeekAscStartTimeAsc(candidateId);
        if (blocks.isEmpty()) return true;  // tanımlamadıysa engelleme

        var slots = listing.getShiftSlots();
        if (slots == null || slots.isEmpty()) return true;  // ilan slot kullanmıyorsa filtre yok

        for (var slot : slots) {
            if (slot.getDate() == null || slot.getStartTime() == null || slot.getEndTime() == null) continue;
            var slotDow = slot.getDate().getDayOfWeek();
            for (var b : blocks) {
                if (b.getDayOfWeek() != slotDow) continue;
                if (!b.getStartTime().isAfter(slot.getStartTime())
                        && !slot.getEndTime().isAfter(b.getEndTime())) {
                    return true;  // bu slot bu bloğa tamamen uyuyor
                }
            }
        }
        return false;
    }

    /** D3: ilk N işletme fotoğrafının URL'leri — kartta hover carousel için. */
    private List<String> loadBusinessPhotoUrls(Long businessId) {
        return businessPhotoRepository
                .findAllByBusinessIdOrderByDisplayOrderAscCreatedAtAsc(businessId)
                .stream()
                .limit(5)
                .map(p -> fileStorageService.publicUrl(p.getFilePath()))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    // ----------------------------------------------------------------
    // DTOs
    // ----------------------------------------------------------------
    @Data
    public static class ListingRequest {
        @NotNull private Position position;
        @NotNull private JobType jobType;
        @NotBlank private String title;
        @NotBlank private String description;
        private String requirements;
        private BigDecimal salaryMin;
        private BigDecimal salaryMax;
        // FAZ 2/#25 — Ucret seffafligi
        private SalaryType salaryType;
        private Boolean tipsIncluded;
        private LocalDate startDate;
        private LocalDate endDate;
        private LocalTime shiftStart;
        private LocalTime shiftEnd;
        // shift kategorisi (Sabah/Akşam/Gece) UI'dan kaldirildi — slot saatleri yeterli
        private Shift shift;

        // Faz E1: Vardiya slotları — yeni ilanlar için en az 1 zorunlu
        private List<ShiftSlotCreate> shiftSlots;
    }

    @Data
    public static class ShiftSlotCreate {
        /** Mevcut slotu güncellerken kullanılır; yeni slotta null */
        private Long id;
        @NotNull private LocalDate date;
        @NotNull private LocalTime startTime;
        @NotNull private LocalTime endTime;
        /** Bu slot için kaç aday kabul edilecek (default 1) */
        private Integer slotsNeeded;
    }

    @Data @Builder
    public static class ShiftSlotDto {
        private Long id;
        private LocalDate date;
        private LocalTime startTime;
        private LocalTime endTime;
        private Integer slotsNeeded;
        private Integer slotsFilled;
        private boolean full;
    }

    @Data @Builder
    public static class ListingResponse {
        private Long id;
        private String position;
        private String jobType;
        private String title;
        private String description;
        private String requirements;
        private BigDecimal salaryMin;
        private BigDecimal salaryMax;
        // FAZ 2/#25 — Ucret tipi seffafligi
        private String salaryType;     // HOURLY/DAILY/MONTHLY/NEGOTIABLE veya null
        private Boolean tipsIncluded;  // true = bahsis dahil
        private LocalDate startDate;
        private LocalDate endDate;
        private LocalTime shiftStart;
        private LocalTime shiftEnd;
        private String shift;
        private String status;
        private Long businessId;
        private String businessName;
        private String businessType;
        private String businessDistrict;
        private String businessNeighborhood;
        private String businessAddress;
        private BigDecimal businessLatitude;
        private BigDecimal businessLongitude;
        // R3
        private Double businessAverageRating;
        private Long businessReviewCount;
        private LocalDateTime createdAt;

        // Faz E1
        private List<ShiftSlotDto> shiftSlots;

        // FAZ D3 — işletme galeri fotoğrafları (ilk 5), hover carousel için
        private List<String> businessPhotoUrls;
    }
}
