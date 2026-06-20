package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Shift;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.service.JobListingService.ListingResponse;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * FAZ B (CQRS deepening) — JobListing read-only sorgular.
 *
 * JobListingService god class değildi ama write + read karışıktı.
 * Bu split CQRS-lite pattern'ini tutarlı kılar:
 *  - JobListingService     → command (create/update/status)
 *  - JobListingQueryService → query (list/search/getById)
 *
 * Mapping helpers (toResponse/toResponses) JobListingService'de package-private
 * tutuldu — duplicate koddan kaçınmak için. İkisi de aynı paketteki bean.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JobListingQueryService {

    private final JobListingRepository jobListingRepository;
    private final JobListingService jobListingService;  // mapping delegasyonu icin

    /** Public: aktif ilan listele, dinamik filtre (Specification). */
    @Transactional(readOnly = true)
    public List<ListingResponse> getActiveListings(
            Position position, JobType jobType, List<Shift> shifts,
            String district, BigDecimal minSalary, String keyword,
            LocalDate dateFrom, LocalDate dateTo
    ) {
        Specification<JobListing> spec = buildActiveListingSpec(
                position, jobType, shifts, district, minSalary, keyword, dateFrom, dateTo);
        return jobListingService.toResponses(jobListingRepository.findAll(spec));
    }

    /** Business owner: kendi ilanları (defensive 500 cap). */
    @Transactional(readOnly = true)
    public List<ListingResponse> getMyListings(Long ownerId) {
        var all = jobListingRepository.findAllByBusiness_OwnerId(ownerId);
        if (all.size() > 500) {
            log.warn("[GET-MY-LISTINGS] ownerId={} icin {} ilan var (>500), ilk 500 doneriyor",
                    ownerId, all.size());
            all = all.subList(0, 500);
        }
        return jobListingService.toResponses(all);
    }

    /** Tek ilan detayı. */
    @Transactional(readOnly = true)
    public ListingResponse getListingById(Long id) {
        JobListing listing = jobListingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("İlan", id));
        return jobListingService.toResponse(listing);
    }

    private Specification<JobListing> buildActiveListingSpec(
            Position position, JobType jobType, List<Shift> shifts,
            String district, BigDecimal minSalary, String keyword,
            LocalDate dateFrom, LocalDate dateTo
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("status"), ListingStatus.ACTIVE));

            if (position != null) predicates.add(cb.equal(root.get("position"), position));
            if (jobType != null)  predicates.add(cb.equal(root.get("jobType"), jobType));
            if (shifts != null && !shifts.isEmpty()) predicates.add(root.get("shift").in(shifts));
            if (district != null && !district.isBlank()) {
                Join<JobListing, Business> bizJoin = root.join("business");
                predicates.add(cb.equal(bizJoin.get("district"), district));
            }
            if (minSalary != null) predicates.add(cb.greaterThanOrEqualTo(root.get("salaryMin"), minSalary));
            if (keyword != null && !keyword.isBlank()) {
                // Full-text search — title + description + requirements + position enum +
                // business name. district join'i tetiklemeden tek alias kullanilir.
                String pattern = "%" + keyword.toLowerCase() + "%";
                Join<JobListing, Business> bizForKw = root.join("business", JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")),        pattern),
                        cb.like(cb.lower(root.get("description")),  pattern),
                        cb.like(cb.lower(root.get("requirements")), pattern),
                        cb.like(cb.lower(root.get("position").as(String.class)), pattern),
                        cb.like(cb.lower(bizForKw.get("name")),     pattern)
                ));
                query.distinct(true);
            }
            if (dateFrom != null || dateTo != null) {
                query.distinct(true);
                Join<JobListing, com.hotelapp.entity.ShiftSlot> slotJoin = root.join("shiftSlots");
                if (dateFrom != null) predicates.add(cb.greaterThanOrEqualTo(slotJoin.get("date"), dateFrom));
                if (dateTo != null)   predicates.add(cb.lessThanOrEqualTo(slotJoin.get("date"), dateTo));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
