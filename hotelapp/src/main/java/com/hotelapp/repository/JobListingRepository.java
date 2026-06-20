package com.hotelapp.repository;

import com.hotelapp.entity.JobListing;
import com.hotelapp.enums.Position;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface JobListingRepository
        extends JpaRepository<JobListing, Long>, JpaSpecificationExecutor<JobListing> {

    List<JobListing> findAllByBusiness_OwnerId(Long ownerId);

    /** #88: Bir işletmenin belirli statüde kaç ilanı var? (örn. ACTIVE) */
    long countByBusiness_OwnerIdAndStatus(Long ownerId, com.hotelapp.enums.ListingStatus status);

    /** FAZ G.8 — Platform geneli aktif ilan sayisi. */
    long countByStatus(com.hotelapp.enums.ListingStatus status);

    /** FAZ G.8 — Bu ay icinde yayinlanan ilan sayisi (momentum gostergesi). */
    long countByCreatedAtAfter(java.time.LocalDateTime threshold);

    /** Dalga 4 / Teknik 5 — View counter atomik artirma (single UPDATE). */
    @Modifying
    @Query("UPDATE JobListing j SET j.viewCount = j.viewCount + 1 WHERE j.id = :id")
    int incrementViewCount(@Param("id") Long id);

    /**
     * Dalga 4 / Ozellik 6 — Maas benchmark: pozisyon bazli aktif ilanlarin
     * AVG(salaryMin), AVG(salaryMax), MIN(salaryMin), MAX(salaryMax), COUNT(*).
     * Sadece salaryMin null olmayan ilanlar dahil.
     */
    @Query("""
        SELECT AVG(j.salaryMin), AVG(j.salaryMax), MIN(j.salaryMin), MAX(j.salaryMax), COUNT(j)
        FROM JobListing j
        WHERE j.position = :position
          AND j.status = com.hotelapp.enums.ListingStatus.ACTIVE
          AND j.salaryMin IS NOT NULL
    """)
    Object[] salaryBenchmark(@Param("position") Position position);
}
