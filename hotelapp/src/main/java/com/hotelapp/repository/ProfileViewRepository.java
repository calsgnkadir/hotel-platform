package com.hotelapp.repository;

import com.hotelapp.entity.ProfileView;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface ProfileViewRepository extends JpaRepository<ProfileView, Long> {

    /** Belirli bir tarihten sonraki bakim sayisi (son 90 gun vs.) */
    @Query("SELECT COUNT(p) FROM ProfileView p " +
           "WHERE p.profileId = :profileId AND p.viewedAt >= :since")
    long countByProfileIdSince(@Param("profileId") Long profileId,
                                @Param("since") LocalDateTime since);

    /** UNIQUE viewer sayisi (1 isletme 5 kere baksa 1 sayilir) */
    @Query("SELECT COUNT(DISTINCT p.viewerId) FROM ProfileView p " +
           "WHERE p.profileId = :profileId AND p.viewedAt >= :since " +
           "AND p.viewerId IS NOT NULL")
    long countDistinctViewersByProfileIdSince(@Param("profileId") Long profileId,
                                               @Param("since") LocalDateTime since);

    /** Bu viewer bu profile bugun zaten baktiysa true — soft-dedupe */
    @Query("SELECT COUNT(p) > 0 FROM ProfileView p " +
           "WHERE p.profileId = :profileId AND p.viewerId = :viewerId " +
           "AND p.viewedAt >= :startOfDay")
    boolean existsTodayByProfileAndViewer(@Param("profileId") Long profileId,
                                          @Param("viewerId") Long viewerId,
                                          @Param("startOfDay") LocalDateTime startOfDay);
}
