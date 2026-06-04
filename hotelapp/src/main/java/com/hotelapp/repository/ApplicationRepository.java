package com.hotelapp.repository;

import com.hotelapp.entity.Application;
import com.hotelapp.enums.ApplicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findAllByCandidateId(Long candidateId);

    List<Application> findAllByJobListing_Business_OwnerId(Long ownerId);

    List<Application> findAllByJobListing_Business_OwnerIdAndStatus(Long ownerId, ApplicationStatus status);

    List<Application> findAllByJobListingId(Long jobListingId);

    @Query("SELECT a FROM Application a WHERE a.status = 'PENDING' AND a.deadline < :now")
    List<Application> findExpiredApplications(LocalDateTime now);

    // ----------------------------------------------------------------
    // #84: Sayfalanmış + filtrelenebilir sorgular
    // Tüm filtre parametreleri opsiyonel (:param IS NULL OR ...) deseniyle.
    // ----------------------------------------------------------------

    /** Aday: kendi başvuruları, opsiyonel status filtresi. */
    @Query("""
        SELECT a FROM Application a
        WHERE a.candidate.id = :candidateId
          AND (:status IS NULL OR a.status = :status)
    """)
    Page<Application> searchCandidateApplications(
            @Param("candidateId") Long candidateId,
            @Param("status") ApplicationStatus status,
            Pageable pageable);

    /** İşletme: kendi ilanlarına gelen başvurular; status + ilan + aday adı araması opsiyonel. */
    @Query("""
        SELECT a FROM Application a
        WHERE a.jobListing.business.owner.id = :ownerId
          AND (:status IS NULL OR a.status = :status)
          AND (:listingId IS NULL OR a.jobListing.id = :listingId)
          AND (:q IS NULL OR LOWER(a.candidate.fullName) LIKE LOWER(CONCAT('%', :q, '%')))
    """)
    Page<Application> searchBusinessApplications(
            @Param("ownerId") Long ownerId,
            @Param("status") ApplicationStatus status,
            @Param("listingId") Long listingId,
            @Param("q") String q,
            Pageable pageable);
}
