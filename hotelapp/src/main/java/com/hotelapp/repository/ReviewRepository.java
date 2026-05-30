package com.hotelapp.repository;

import com.hotelapp.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    Optional<Review> findByApplicationIdAndByRole(Long applicationId, String byRole);

    /** Bir işletmenin aldığı tüm yorumlar (aday → işletme) */
    @Query("SELECT r FROM Review r " +
           "WHERE r.byRole = 'CANDIDATE' " +
           "AND r.application.jobListing.business.id = :businessId " +
           "ORDER BY r.createdAt DESC")
    List<Review> findReviewsForBusiness(@Param("businessId") Long businessId);

    /** Bir adayın aldığı tüm yorumlar (işletme → aday) */
    @Query("SELECT r FROM Review r " +
           "WHERE r.byRole = 'BUSINESS' " +
           "AND r.application.candidate.id = :candidateId " +
           "ORDER BY r.createdAt DESC")
    List<Review> findReviewsForCandidate(@Param("candidateId") Long candidateId);

    /** Bir işletmenin ortalama puanı ve yorum sayısı [avg, count] */
    @Query("SELECT AVG(r.rating), COUNT(r) FROM Review r " +
           "WHERE r.byRole = 'CANDIDATE' " +
           "AND r.application.jobListing.business.id = :businessId")
    Object[] aggregateForBusiness(@Param("businessId") Long businessId);

    @Query("SELECT AVG(r.rating), COUNT(r) FROM Review r " +
           "WHERE r.byRole = 'BUSINESS' " +
           "AND r.application.candidate.id = :candidateId")
    Object[] aggregateForCandidate(@Param("candidateId") Long candidateId);
}
