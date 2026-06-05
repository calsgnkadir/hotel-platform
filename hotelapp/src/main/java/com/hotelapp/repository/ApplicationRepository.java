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

    // ----------------------------------------------------------------
    // #88: Dashboard stats (aggregation)
    // ----------------------------------------------------------------

    /** İşletme: belirli aralıkta başvuru sayısı. */
    @Query("""
        SELECT COUNT(a) FROM Application a
        WHERE a.jobListing.business.owner.id = :ownerId
          AND a.createdAt >= :start
          AND a.createdAt < :end
    """)
    long countBusinessApplicationsInRange(
            @Param("ownerId") Long ownerId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    /** İşletme: status bazlı sayım. [status, count] çiftleri. */
    @Query("""
        SELECT a.status, COUNT(a) FROM Application a
        WHERE a.jobListing.business.owner.id = :ownerId
        GROUP BY a.status
    """)
    List<Object[]> countBusinessApplicationsByStatus(@Param("ownerId") Long ownerId);

    /** İşletme: pozisyon bazlı sayım. [position, count] çiftleri. */
    @Query("""
        SELECT a.jobListing.position, COUNT(a) FROM Application a
        WHERE a.jobListing.business.owner.id = :ownerId
        GROUP BY a.jobListing.position
        ORDER BY COUNT(a) DESC
    """)
    List<Object[]> countBusinessApplicationsByPosition(@Param("ownerId") Long ownerId);

    /** İşletme: günlük başvuru sayımı, son N gün için. [date, count] çiftleri. */
    @Query("""
        SELECT CAST(a.createdAt AS LocalDate), COUNT(a) FROM Application a
        WHERE a.jobListing.business.owner.id = :ownerId
          AND a.createdAt >= :since
        GROUP BY CAST(a.createdAt AS LocalDate)
        ORDER BY CAST(a.createdAt AS LocalDate) ASC
    """)
    List<Object[]> dailyApplicationCountForBusiness(
            @Param("ownerId") Long ownerId,
            @Param("since") LocalDateTime since);

    /** Aday: status bazlı sayım. */
    @Query("""
        SELECT a.status, COUNT(a) FROM Application a
        WHERE a.candidate.id = :candidateId
        GROUP BY a.status
    """)
    List<Object[]> countCandidateApplicationsByStatus(@Param("candidateId") Long candidateId);

    /** Aday: aylık başvuru sayımı (YYYY-MM key). */
    @Query("""
        SELECT FUNCTION('DATE_FORMAT', a.createdAt, '%Y-%m'), COUNT(a) FROM Application a
        WHERE a.candidate.id = :candidateId
          AND a.createdAt >= :since
        GROUP BY FUNCTION('DATE_FORMAT', a.createdAt, '%Y-%m')
        ORDER BY FUNCTION('DATE_FORMAT', a.createdAt, '%Y-%m') ASC
    """)
    List<Object[]> monthlyApplicationCountForCandidate(
            @Param("candidateId") Long candidateId,
            @Param("since") LocalDateTime since);

    /** Aday: ortalama yanıt süresi (saat). reviewedAt - createdAt. Null safe. */
    @Query("""
        SELECT AVG(FUNCTION('TIMESTAMPDIFF', SECOND, a.createdAt, a.reviewedAt)) FROM Application a
        WHERE a.candidate.id = :candidateId
          AND a.reviewedAt IS NOT NULL
    """)
    Double avgResponseSecondsForCandidate(@Param("candidateId") Long candidateId);
}
