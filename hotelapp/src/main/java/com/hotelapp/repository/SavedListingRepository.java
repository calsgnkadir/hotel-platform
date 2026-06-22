package com.hotelapp.repository;

import com.hotelapp.entity.SavedListing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface SavedListingRepository extends JpaRepository<SavedListing, Long> {

    boolean existsByUserIdAndJobListingId(Long userId, Long jobListingId);

    Optional<SavedListing> findByUserIdAndJobListingId(Long userId, Long jobListingId);

    /** Aday'in tum kaydettikleri — yeniden eskiye */
    List<SavedListing> findByUserIdOrderByCreatedAtDesc(Long userId);

    void deleteByUserIdAndJobListingId(Long userId, Long jobListingId);

    /** Bulk lookup: ListingsPage'de hangilerinin saved oldugu */
    @Query("SELECT s.jobListing.id FROM SavedListing s WHERE s.user.id = :userId")
    Set<Long> findJobListingIdsByUserId(@Param("userId") Long userId);

    long countByUserId(Long userId);
}
