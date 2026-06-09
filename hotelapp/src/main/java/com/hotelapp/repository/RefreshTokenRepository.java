package com.hotelapp.repository;

import com.hotelapp.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("UPDATE RefreshToken r SET r.revoked = true WHERE r.user.id = :userId AND r.revoked = false")
    int revokeAllForUser(@Param("userId") Long userId);

    /** Cleanup: süresi geçmiş veya revoked + 30 gün eski kayıtları sil */
    @Modifying
    @Query("DELETE FROM RefreshToken r WHERE r.expiresAt < :before OR (r.revoked = true AND r.createdAt < :before)")
    int deleteExpiredAndRevoked(@Param("before") LocalDateTime before);
}
