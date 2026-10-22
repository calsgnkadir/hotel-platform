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

    /** Serialize QR, manual and GPS entry writes before checking existing sessions. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Application a WHERE a.id = :id")
    Optional<Application> findByIdForCheckIn(@Param("id") Long id);

    List<Application> findAllByCandidateId(Long candidateId);

    /** Kabul kapısı: adayın verilen durumdaki başvuruları (vardiya çakışması kontrolü). */
    List<Application> findAllByCandidateIdAndStatus(Long candidateId, ApplicationStatus status);

    /**
     * FAZ F.6 — GDPR export icin N+1 fix: jobListing + business eager fetch.
     * Genel findAllByCandidateId'i degistirmedik (diger cagri noktalarinin
     * davranisini bozmamak icin); export-spesifik ayri yontem.
     */
    @EntityGraph(attributePaths = { "jobListing", "jobListing.business" })
    @Query("SELECT a FROM Application a WHERE a.candidate.id = :candidateId")
    List<Application> findAllByCandidateIdForExport(
            @Param("candidateId") Long candidateId);

    /**
     * Aynı ilana yeniden başvuru kontrolü için spot sorgu.
     * Eski yaklaşım: tüm aday başvurularını getir + stream'de filtre — DB'yi boğardı.
     */
    Optional<Application> findFirstByCandidateIdAndJobListingIdAndStatusIn(
            Long candidateId, Long jobListingId, Collection<ApplicationStatus> statuses);

    // ----------------------------------------------------------------
    // Vardiya bazli tamamlanan is / gelmedi sayimlari (V25 sonrasi kural)
    //  - Tamamlanan: ACCEPTED ve (gelmedi isareti yok YA DA en az bir vardiyasi
    //    isaretsiz ve vardiya bazli isaret var). Tek vardiyalik gelmedi basvuruyu
    //    dusurmez; tum vardiyalari isaretli basvuru duser.
    //  - Eski kayit (V25 oncesi: noShow=true, application_no_show_slots'ta satir yok)
    //    eskisi gibi duser.
    //  - Gelmedi sayisi: isaretli vardiya satiri basina 1 + eski kayit basina 1.
    // ----------------------------------------------------------------

    /** Adayın tamamlanmış iş sayısı (vardiya bazlı kural; bkz. blok açıklaması). */
    @Query("""
        SELECT COUNT(a) FROM Application a
        WHERE a.candidate.id = :candidateId
          AND a.status = com.hotelapp.enums.ApplicationStatus.ACCEPTED
          AND (a.noShow = false
               OR (EXISTS (SELECT 1 FROM ApplicationNoShowSlot m WHERE m.application = a)
                   AND EXISTS (SELECT 1 FROM Application a2 JOIN a2.requestedSlots s
                               WHERE a2 = a
                                 AND NOT EXISTS (SELECT 1 FROM ApplicationNoShowSlot m2
                                                 WHERE m2.application = a AND m2.shiftSlot = s))))
          AND (NOT EXISTS (SELECT 1 FROM Application a3 JOIN a3.requestedSlots s3 WHERE a3 = a)
               OR EXISTS (SELECT 1 FROM Application a4 JOIN a4.requestedSlots s4
                          WHERE a4 = a
                            AND ((s4.endTime > s4.startTime
                                  AND (s4.date < :today OR (s4.date = :today AND s4.endTime <= :nowTime)))
                              OR (s4.endTime <= s4.startTime
                                  AND (s4.date < :yesterday OR (s4.date = :yesterday AND s4.endTime <= :nowTime))))
                            AND NOT EXISTS (SELECT 1 FROM ApplicationNoShowSlot m4
                                            WHERE m4.application = a AND m4.shiftSlot = s4)))
    """)
    long countCompletedJobsForCandidateAt(@Param("candidateId") Long candidateId,
                                          @Param("today") java.time.LocalDate today,
                                          @Param("yesterday") java.time.LocalDate yesterday,
                                          @Param("nowTime") java.time.LocalTime nowTime);

    /**
     * Tamamlanan iş: yukarıdaki kural + en az bir gelmedi işaretsiz vardiyası BİTMİŞ olmalı
     * (ShiftWindow: gece vardiyası ertesi gün biter; Europe/Istanbul). İleri tarihli kabul sayılmaz.
     * Slotsuz eski başvuru tamamlanmış sayılır (geriye uyum).
     */
    default long countCompletedJobsForCandidate(Long candidateId) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now(java.time.ZoneId.of("Europe/Istanbul"));
        return countCompletedJobsForCandidateAt(candidateId, now.toLocalDate(),
                now.toLocalDate().minusDays(1), now.toLocalTime());
    }

    /** Adayın vardiya bazlı gelmedi satırı sayısı. */
    @Query("""
        SELECT COUNT(m) FROM ApplicationNoShowSlot m
        WHERE m.application.candidate.id = :candidateId
    """)
    long countNoShowSlotsForCandidate(@Param("candidateId") Long candidateId);

    /** Adayın eski (V25 öncesi, vardiya satırı olmayan) gelmedi başvuru sayısı. */
    @Query("""
        SELECT COUNT(a) FROM Application a
        WHERE a.candidate.id = :candidateId
          AND a.noShow = true
          AND NOT EXISTS (SELECT 1 FROM ApplicationNoShowSlot m WHERE m.application = a)
    """)
    long countLegacyNoShowsForCandidate(@Param("candidateId") Long candidateId);

    /** Adayın gelmedi sayısı: vardiya satırı başına 1 + eski kayıt başına 1. */
    default long countNoShowsForCandidate(Long candidateId) {
        return countNoShowSlotsForCandidate(candidateId) + countLegacyNoShowsForCandidate(candidateId);
    }

    /** Aday bu isletmenin herhangi bir ilanina basvurmus mu — public profile yetki kontrolu (basit) */
    boolean existsByCandidateIdAndJobListingBusinessOwnerId(Long candidateId, Long ownerId);

    /** Bu vardiya slotuna basvurusu olan (application_shift_slots'ta referans) bir basvuru var mi.
     *  Slot silmeden once FK ihlali/veri kaybi engeli icin. */
    boolean existsByRequestedSlots_Id(Long slotId);

    /** Bu vardiyada verilen durumlardan birinde başvuru var mı (ör. bekleyen başvurulu
     *  vardiyanın saati değiştirilemesin). */
    boolean existsByRequestedSlots_IdAndStatusIn(Long slotId, java.util.Collection<ApplicationStatus> statuses);

    /** Aday bu isletmede CALISMIS mi (ACCEPTED basvuru) — hassas bilgi yetki kontrolu */
    boolean existsByCandidateIdAndJobListingBusinessOwnerIdAndStatus(
            Long candidateId, Long ownerId, ApplicationStatus status);

    /**
     * Dalga 4 / Ozellik 4 — Bir isletmede tamamlanmis aday sayisi (guven sinyali).
     * ACCEPTED ve tamamlanmis (unique aday degil — toplam tamamlanan). reviewedAt
     * sarti yok: dogrudan kabul edilen eski kayitlarda reviewedAt bos kalmisti.
     * Vardiya bazli kural: en az bir isaretsiz vardiyasi olan basvuru sayilir; tum
     * vardiyalari gelmedi olan ya da eski kayit (noShow=true, satir yok) dusulur.
     */
    @Query("""
        SELECT COUNT(a) FROM Application a
        WHERE a.jobListing.business.owner.id = :ownerId
          AND a.status = com.hotelapp.enums.ApplicationStatus.ACCEPTED
          AND (a.noShow = false
               OR (EXISTS (SELECT 1 FROM ApplicationNoShowSlot m WHERE m.application = a)
                   AND EXISTS (SELECT 1 FROM Application a2 JOIN a2.requestedSlots s
                               WHERE a2 = a
                                 AND NOT EXISTS (SELECT 1 FROM ApplicationNoShowSlot m2
                                                 WHERE m2.application = a AND m2.shiftSlot = s))))
          AND (NOT EXISTS (SELECT 1 FROM Application a3 JOIN a3.requestedSlots s3 WHERE a3 = a)
               OR EXISTS (SELECT 1 FROM Application a4 JOIN a4.requestedSlots s4
                          WHERE a4 = a
                            AND ((s4.endTime > s4.startTime
                                  AND (s4.date < :today OR (s4.date = :today AND s4.endTime <= :nowTime)))
                              OR (s4.endTime <= s4.startTime
                                  AND (s4.date < :yesterday OR (s4.date = :yesterday AND s4.endTime <= :nowTime))))
                            AND NOT EXISTS (SELECT 1 FROM ApplicationNoShowSlot m4
                                            WHERE m4.application = a AND m4.shiftSlot = s4)))
    """)
    long countCompletedByBusinessOwnerAt(@Param("ownerId") Long ownerId,
                                         @Param("today") java.time.LocalDate today,
                                         @Param("yesterday") java.time.LocalDate yesterday,
                                         @Param("nowTime") java.time.LocalTime nowTime);

    /** İşletmede tamamlanan iş — aday sayımıyla aynı kural (bitmiş vardiya şartı dahil). */
    default long countCompletedByBusinessOwner(Long ownerId) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now(java.time.ZoneId.of("Europe/Istanbul"));
        return countCompletedByBusinessOwnerAt(ownerId, now.toLocalDate(),
                now.toLocalDate().minusDays(1), now.toLocalTime());
    }

    List<Application> findAllByJobListing_Business_OwnerId(Long ownerId);

    /** Sohbetten belge paylaşımı: çiftin en son başvurusu (izin buna bağlanır). */
    Optional<Application> findFirstByCandidateIdAndJobListing_Business_OwnerIdOrderByCreatedAtDesc(
            Long candidateId, Long ownerId);

    List<Application> findAllByJobListing_Business_OwnerIdAndStatus(Long ownerId, ApplicationStatus status);

    List<Application> findAllByJobListingId(Long jobListingId);

    /** İlan kapanışı — ilanın verilen durumlardaki (açık) başvuruları. */
    List<Application> findAllByJobListingIdAndStatusIn(Long jobListingId,
                                                       java.util.Collection<ApplicationStatus> statuses);

    @Query("SELECT a FROM Application a WHERE a.status = 'PENDING' AND a.deadline < :now")
    List<Application> findExpiredApplications(LocalDateTime now);

    // FAZ 2/#28 — Suresi gecmis HOLD'lar (scheduler her 5 dakika EXPIRED yapar)
    List<Application> findByStatusAndHoldDeadlineBefore(ApplicationStatus status, LocalDateTime deadline);

    // ----------------------------------------------------------------
    // FAZ C.1 — Yedek (standby) aday sistemi
    // ----------------------------------------------------------------

    /**
     * Bir ilanin teklif bekleyen yedekleri — rank sirasinda.
     * standbyOfferedAt IS NULL: henuz teklif gonderilmemis olanlar
     * (ayni yedege iki kez teklif gitmesin).
     */
    @EntityGraph(attributePaths = { "candidate", "jobListing", "jobListing.business" })
    @Query("""
        SELECT a FROM Application a
        WHERE a.jobListing.id = :listingId
          AND a.status = com.hotelapp.enums.ApplicationStatus.STANDBY
          AND a.standbyOfferedAt IS NULL
        ORDER BY COALESCE(a.standbyRank, 9999) ASC, a.createdAt ASC
    """)
    List<Application> findAvailableStandbys(@Param("listingId") Long listingId);

    /** Ilandaki mevcut yedek sayisi — yeni yedege rank atamak icin. */
    long countByJobListingIdAndStatus(Long jobListingId, ApplicationStatus status);

    /** Suresi gecmis yedek teklifleri (scheduler her 5 dakika temizler). */
    List<Application> findByStatusAndStandbyDeadlineBefore(
            ApplicationStatus status, LocalDateTime deadline);

    // ----------------------------------------------------------------
    // FAZ C.3 — SGK ise giris bildirgesi hatirlaticisi
    // ----------------------------------------------------------------

    /**
     * Vardiyasi yaklasan, henuz SGK hatirlatmasi gonderilmemis kabul edilmis
     * basvurular. En az bir slotu [from, to] araliginda olanlar.
     * DISTINCT: bir basvurunun birden cok slotu araliga duserse tekrar etmesin.
     */
    @EntityGraph(attributePaths = { "candidate", "jobListing", "jobListing.business" })
    @Query("""
        SELECT DISTINCT a FROM Application a
        JOIN a.requestedSlots s
        WHERE a.status = com.hotelapp.enums.ApplicationStatus.ACCEPTED
          AND a.noShow = false
          AND a.sgkReminderSentAt IS NULL
          AND s.date BETWEEN :from AND :to
    """)
    List<Application> findAcceptedNeedingSgkReminder(
            @Param("from") java.time.LocalDate from,
            @Param("to") java.time.LocalDate to);

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

    /** FAZ G.8 — Platform geneli son N saatte yapilan basvuru sayisi (pulse). */
    long countByCreatedAtAfter(LocalDateTime threshold);
}
