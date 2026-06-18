package com.hotelapp.repository;

import com.hotelapp.entity.Application;
import com.hotelapp.enums.ApplicationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ApplicationRepository extends JpaRepository<Application, Long> {

    List<Application> findAllByCandidateId(Long candidateId);

    /**
     * Aynı ilana yeniden başvuru kontrolü için spot sorgu.
     * Eski yaklaşım: tüm aday başvurularını getir + stream'de filtre — DB'yi boğardı.
     */
    Optional<Application> findFirstByCandidateIdAndJobListingIdAndStatusIn(
            Long candidateId, Long jobListingId, Collection<ApplicationStatus> statuses);

    // ----------------------------------------------------------------
    // Reliability score için yardımcı sayımlar
    // ----------------------------------------------------------------

    /** Adayın toplam no-show kaydı (her statüden). */
    long countByCandidateIdAndNoShowTrue(Long candidateId);

    /**
     * Adayın belirtilen tarihten itibaren tamamlanmış (ACCEPTED + reviewedAt set +
     * no-show değil) başvuru sayısı. Reliability skorunda "son 90 gün tamamlanmış iş"
     * bonusu için kullanılır.
     */
    @Query("""
        SELECT COUNT(a) FROM Application a
        WHERE a.candidate.id = :candidateId
          AND a.status = com.hotelapp.enums.ApplicationStatus.ACCEPTED
          AND a.noShow = false
          AND a.reviewedAt IS NOT NULL
          AND a.reviewedAt >= :since
    """)
    long countCompletedAcceptedSince(
            @Param("candidateId") Long candidateId,
            @Param("since") LocalDateTime since);

    /** Tüm zaman tamamlanmış iş sayısı — reliability oranı penalty denominatörü için. */
    @Query("""
        SELECT COUNT(a) FROM Application a
        WHERE a.candidate.id = :candidateId
          AND a.status = com.hotelapp.enums.ApplicationStatus.ACCEPTED
          AND a.noShow = false
          AND a.reviewedAt IS NOT NULL
    """)
    long countCompletedAcceptedAllTime(@Param("candidateId") Long candidateId);

    List<Application> findAllByJobListing_Business_OwnerId(Long ownerId);

    List<Application> findAllByJobListing_Business_OwnerIdAndStatus(Long ownerId, ApplicationStatus status);

    List<Application> findAllByJobListingId(Long jobListingId);

    @Query("SELECT a FROM Application a WHERE a.status = 'PENDING' AND a.deadline < :now")
    List<Application> findExpiredApplications(LocalDateTime now);

    // FAZ 2/#28 — Suresi gecmis HOLD'lar (scheduler her 5 dakika EXPIRED yapar)
    List<Application> findByStatusAndHoldDeadlineBefore(ApplicationStatus status, LocalDateTime deadline);

    // ----------------------------------------------------------------
    // #84: Sayfalanmış + filtrelenebilir sorgular
    // Tüm filtre parametreleri opsiyonel (:param IS NULL OR ...) deseniyle.
    // ----------------------------------------------------------------

    /**
     * Aday: kendi başvuruları, opsiyonel status filtresi.
     * N+1 fix: candidate + jobListing + business eager fetch.
     */
    @EntityGraph(attributePaths = { "candidate", "jobListing", "jobListing.business" })
    @Query("""
        SELECT a FROM Application a
        WHERE a.candidate.id = :candidateId
          AND (:status IS NULL OR a.status = :status)
    """)
    Page<Application> searchCandidateApplications(
            @Param("candidateId") Long candidateId,
            @Param("status") ApplicationStatus status,
            Pageable pageable);

    /**
     * İşletme: kendi ilanlarına gelen başvurular; status + ilan + aday adı araması opsiyonel.
     * N+1 fix: candidate + jobListing + business eager fetch.
     */
    @EntityGraph(attributePaths = { "candidate", "jobListing", "jobListing.business" })
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

    /**
     * Aday: ortalama yanıt süresi (saniye). reviewedAt - createdAt. Null safe.
     * Hibernate 6.4'te FUNCTION() çağrısı dönüş tipini bilemediği için AVG'a
     * tip ipucu vermek üzere CAST AS double ekledik. Aksi halde:
     *   "Parameter 1 of function 'avg()' has type 'NUMERIC', but argument is of type 'java.lang.Object'"
     */
    @Query("""
        SELECT AVG(CAST(FUNCTION('TIMESTAMPDIFF', SECOND, a.createdAt, a.reviewedAt) AS double))
        FROM Application a
        WHERE a.candidate.id = :candidateId
          AND a.reviewedAt IS NOT NULL
    """)
    Double avgResponseSecondsForCandidate(@Param("candidateId") Long candidateId);
}
