package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.User;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Shift;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.UserRepository;
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
    private final UserRepository userRepository;        // FAZ 5 — ranked sort

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

    /**
     * FAZ 5 — Kişiselleştirilmiş "Sana Özel" sıralama.
     *
     * Skor (max 110):
     *  - position ∈ preferredPositions  → +50
     *  - district ∈ preferredDistricts  → +30
     *  - jobType ∈ availabilityTypes    → +20
     *  - createdAt recency (son 30 gün) → +10 (lineer azalır)
     *
     * Kullanıcı yoksa veya aday değilse skor 0 — sıralama createdAt DESC olur.
     */
    @Transactional(readOnly = true)
    public List<ListingResponse> getActiveListingsRanked(
            Long candidateUserId,
            Position position, JobType jobType, List<Shift> shifts,
            String district, BigDecimal minSalary, String keyword,
            LocalDate dateFrom, LocalDate dateTo
    ) {
        Specification<JobListing> spec = buildActiveListingSpec(
                position, jobType, shifts, district, minSalary, keyword, dateFrom, dateTo);
        List<JobListing> raw = jobListingRepository.findAll(spec);

        if (candidateUserId == null || raw.isEmpty()) {
            return jobListingService.toResponses(raw);
        }

        User candidate = userRepository.findById(candidateUserId).orElse(null);
        if (candidate == null) {
            return jobListingService.toResponses(raw);
        }

        java.util.Set<Position> prefPositions = candidate.getPreferredPositions();
        java.util.Set<String>   prefDistricts = candidate.getPreferredDistricts();
        java.util.Set<JobType>  prefJobTypes  = candidate.getAvailabilityTypes();

        java.time.LocalDateTime now = java.time.LocalDateTime.now();

        // Score'u entity üzerinde hesapla, sıralayıp sonra DTO'ya map et
        raw.sort((a, b) -> {
            int sa = scoreListing(a, prefPositions, prefDistricts, prefJobTypes, now);
            int sb = scoreListing(b, prefPositions, prefDistricts, prefJobTypes, now);
            if (sa != sb) return Integer.compare(sb, sa);  // higher score first
            // tiebreak: yeni → eski
            return b.getCreatedAt().compareTo(a.getCreatedAt());
        });

        return jobListingService.toResponses(raw);
    }

    private static int scoreListing(JobListing l,
                                    java.util.Set<Position> prefPositions,
                                    java.util.Set<String> prefDistricts,
                                    java.util.Set<JobType> prefJobTypes,
                                    java.time.LocalDateTime now) {
        int score = 0;
        if (prefPositions != null && !prefPositions.isEmpty()
                && l.getPosition() != null && prefPositions.contains(l.getPosition())) {
            score += 50;
        }
        if (prefDistricts != null && !prefDistricts.isEmpty()
                && l.getBusiness() != null
                && l.getBusiness().getDistrict() != null
                && prefDistricts.contains(l.getBusiness().getDistrict())) {
            score += 30;
        }
        if (prefJobTypes != null && !prefJobTypes.isEmpty()
                && l.getJobType() != null && prefJobTypes.contains(l.getJobType())) {
            score += 20;
        }
        if (l.getCreatedAt() != null) {
            long hoursOld = java.time.Duration.between(l.getCreatedAt(), now).toHours();
            if (hoursOld < 0) hoursOld = 0;
            long maxHours = 30L * 24;  // 30 gün
            if (hoursOld < maxHours) {
                score += (int) (10L * (maxHours - hoursOld) / maxHours);
            }
        }
        return score;
    }

    /**
     * FAZ 5 — SavedSearch matcher: aynı filtre seti, ek olarak createdAt > since.
     * Entity döner ki scheduler id/title/createdAt'e doğrudan erişebilsin.
     */
    @Transactional(readOnly = true)
    public List<JobListing> findActiveSince(
            java.time.LocalDateTime since,
            Position position, JobType jobType, List<Shift> shifts,
            String district, BigDecimal minSalary, String keyword,
            LocalDate dateFrom, LocalDate dateTo
    ) {
        Specification<JobListing> spec = buildActiveListingSpec(
                position, jobType, shifts, district, minSalary, keyword, dateFrom, dateTo);
        if (since != null) {
            spec = spec.and((root, q, cb) -> cb.greaterThan(root.get("createdAt"), since));
        }
        return jobListingRepository.findAll(spec);
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

    // Position enum -> TR + EN keyword'leri. Kullanici "garson" yazinca
    // WAITER pozisyonlu ilanlar da bulunur. Eslestirme: keyword icinde
    // en az bir kelime gecerse o position dahil edilir.
    private static final java.util.Map<Position, java.util.List<String>> POSITION_KEYWORDS =
            java.util.Map.of(
                    Position.WAITER,        java.util.List.of("garson", "servis", "waiter"),
                    Position.DISHWASHER,    java.util.List.of("bulasik", "bulaşık", "dishwasher"),
                    Position.HOUSEKEEPING,  java.util.List.of("kat hizmetleri", "kat", "temizlik", "housekeeping"),
                    Position.RECEPTION,     java.util.List.of("resepsiyon", "front desk", "reception"),
                    Position.KITCHEN_STAFF, java.util.List.of("mutfak", "asci", "aşçı", "kitchen"),
                    Position.BELLBOY,       java.util.List.of("bellboy", "tasiyici", "taşıyıcı"),
                    Position.SECURITY,      java.util.List.of("guvenlik", "güvenlik", "security")
            );

    private static List<Position> matchPositionKeyword(String kwLower) {
        return POSITION_KEYWORDS.entrySet().stream()
                .filter(e -> e.getValue().stream().anyMatch(kwLower::contains))
                .map(java.util.Map.Entry::getKey)
                .toList();
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
                // Full-text search — title + description + requirements + business name +
                // position enum TR/EN keyword mapping. ("garson" -> WAITER ilanlar)
                String kwLower = keyword.toLowerCase();
                String pattern = "%" + kwLower + "%";
                Join<JobListing, Business> bizForKw = root.join("business", JoinType.LEFT);

                List<Position> matchingPositions = matchPositionKeyword(kwLower);
                List<Predicate> ors = new ArrayList<>();
                ors.add(cb.like(cb.lower(root.get("title")),        pattern));
                ors.add(cb.like(cb.lower(root.get("description")),  pattern));
                ors.add(cb.like(cb.lower(root.get("requirements")), pattern));
                ors.add(cb.like(cb.lower(bizForKw.get("name")),     pattern));
                if (!matchingPositions.isEmpty()) {
                    ors.add(root.get("position").in(matchingPositions));
                }
                predicates.add(cb.or(ors.toArray(new Predicate[0])));
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
