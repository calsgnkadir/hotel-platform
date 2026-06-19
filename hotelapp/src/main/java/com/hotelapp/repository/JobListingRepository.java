package com.hotelapp.repository;

import com.hotelapp.entity.JobListing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

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
}
