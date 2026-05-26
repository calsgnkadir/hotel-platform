package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
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
public class JobListingService {

    private final JobListingRepository jobListingRepository;
    private final BusinessRepository businessRepository;

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
        return jobListingRepository.findAll(spec).stream().map(this::toResponse).toList();
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
        return jobListingRepository.findAllByBusiness_OwnerId(ownerId)
                .stream().map(this::toResponse).toList();
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
        return toResponse(listing);
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
        for (int i = 0; i < slots.size(); i++) {
            ShiftSlotCreate s = slots.get(i);
            int n = i + 1;
            if (s.getDate() == null)      throw new BusinessRuleException("Slot " + n + ": tarih zorunlu");
            if (s.getStartTime() == null) throw new BusinessRuleException("Slot " + n + ": başlangıç saati zorunlu");
            if (s.getEndTime() == null)   throw new BusinessRuleException("Slot " + n + ": bitiş saati zorunlu");
            if (s.getDate().isBefore(today)) {
                throw new BusinessRuleException("Slot " + n + ": geçmiş tarih olamaz");
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
        listing.setStartDate(request.getStartDate());
        listing.setEndDate(request.getEndDate());
        listing.setShiftStart(request.getShiftStart());
        listing.setShiftEnd(request.getShiftEnd());

        // Slot diff: id eşleşenleri güncelle, yenileri ekle, kalanları sil
        // (orphanRemoval + cascade ALL ile silme otomatik join_table'a da yansır)
        List<ShiftSlot> existing = listing.getShiftSlots();
        java.util.Map<Long, ShiftSlot> existingById = new java.util.HashMap<>();
        for (ShiftSlot s : existing) {
            if (s.getId() != null) existingById.put(s.getId(), s);
        }

        List<ShiftSlot> updated = new ArrayList<>();
        for (ShiftSlotCreate dto : request.getShiftSlots()) {
            ShiftSlot slot;
            if (dto.getId() != null && existingById.containsKey(dto.getId())) {
                // Mevcut slot — alanları güncelle (slotsFilled korunur)
                slot = existingById.get(dto.getId());
                slot.setDate(dto.getDate());
                slot.setStartTime(dto.getStartTime());
                slot.setEndTime(dto.getEndTime());
                slot.setSlotsNeeded(dto.getSlotsNeeded() == null ? 1 : dto.getSlotsNeeded());
            } else {
                // Yeni slot
                slot = ShiftSlot.builder()
                        .jobListing(listing)
                        .date(dto.getDate())
                        .startTime(dto.getStartTime())
                        .endTime(dto.getEndTime())
                        .slotsNeeded(dto.getSlotsNeeded() == null ? 1 : dto.getSlotsNeeded())
                        .slotsFilled(0)
                        .build();
            }
            updated.add(slot);
        }

        // existing collection'ı in-place değiştir (orphanRemoval için aynı referans olmalı)
        existing.clear();
        existing.addAll(updated);

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

    private ListingResponse toResponse(JobListing l) {
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
                .createdAt(l.getCreatedAt())
                .shiftSlots(slotDtos)
                .build();
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
        private LocalDate startDate;
        private LocalDate endDate;
        private LocalTime shiftStart;
        private LocalTime shiftEnd;
        @NotNull private Shift shift;

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
        private LocalDateTime createdAt;

        // Faz E1
        private List<ShiftSlotDto> shiftSlots;
    }
}
