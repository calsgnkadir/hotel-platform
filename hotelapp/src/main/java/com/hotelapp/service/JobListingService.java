package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
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
            String keyword
    ) {
        Specification<JobListing> spec = buildActiveListingSpec(
                position, jobType, shifts, district, minSalary, keyword);
        return jobListingRepository.findAll(spec).stream().map(this::toResponse).toList();
    }

    private Specification<JobListing> buildActiveListingSpec(
            Position position,
            JobType jobType,
            List<Shift> shifts,
            String district,
            BigDecimal minSalary,
            String keyword
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

        jobListingRepository.save(listing);
        return toResponse(listing);
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
    }
}
