package com.hotelapp.service;

import com.hotelapp.entity.RefreshToken;
import com.hotelapp.entity.User;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;

/**
 * F0.2 — Refresh Token yönetimi.
 *
 * Akış:
 *   1) login → createForUser(user) → raw token (256-bit random) cookie'ye gider,
 *      hash DB'ye yazılır
 *   2) /refresh → validateAndRotate(rawToken) → eski revoke edilir, yenisi üretilir
 *      (reuse detection: revoked token tekrar gelirse user'ın tüm token'ları revoke)
 *   3) logout → revoke(rawToken)
 *
 * Cleanup: her gece 03:00'te eski/revoke kayıtları sil.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenService {

    private final RefreshTokenRepository repo;

    /** 7 gün geçerli (access token 15 dk) */
    private static final long EXPIRES_DAYS = 7;
    private static final SecureRandom RNG = new SecureRandom();

    /**
     * Yeni refresh token üretir, DB'ye hash kaydeder, raw token döner.
     * Raw token sadece çağıran method'a verilir — cookie'ye konup atılır.
     */
    @Transactional
    public String createForUser(User user) {
        String rawToken = generateRawToken();
        RefreshToken entity = RefreshToken.builder()
                .user(user)
                .tokenHash(sha256(rawToken))
                .expiresAt(LocalDateTime.now().plusDays(EXPIRES_DAYS))
                .revoked(false)
                .build();
        repo.save(entity);
        return rawToken;
    }

    /**
     * Cookie'den gelen raw token'i doğrular + rotate eder.
     * Başarılıysa eski token revoke edilir, yeni raw token döner.
     *
     * Güvenlik: revoked token tekrar gelirse (refresh reuse saldırısı) tüm
     * kullanıcı token'ları revoke edilir.
     */
    @Transactional
    public RotationResult validateAndRotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw UnauthorizedException.keyed("error.auth.refreshNotFound");
        }

        String hash = sha256(rawToken);
        RefreshToken token = repo.findByTokenHash(hash)
                .orElseThrow(() -> UnauthorizedException.keyed("error.auth.refreshInvalid"));

        // Reuse detection: revoked olduktan sonra tekrar geldi
        if (token.isRevoked()) {
            log.warn("Refresh token REUSE detected — user {} tüm token'lar revoke edilir",
                    token.getUser().getId());
            repo.revokeAllForUser(token.getUser().getId());
            throw UnauthorizedException.keyed("error.auth.tokenBreach");
        }

        if (token.isExpired()) {
            throw UnauthorizedException.keyed("error.auth.refreshExpired");
        }

        // Eski token revoke + yeni token üret (rotation)
        token.setRevoked(true);
        token.setLastUsedAt(LocalDateTime.now());
        repo.save(token);

        String newRawToken = createForUser(token.getUser());
        return new RotationResult(token.getUser(), newRawToken);
    }

    @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        repo.findByTokenHash(sha256(rawToken)).ifPresent(t -> {
            t.setRevoked(true);
            repo.save(t);
        });
    }

    @Transactional
    public void revokeAllForUser(Long userId) {
        int n = repo.revokeAllForUser(userId);
        if (n > 0) log.info("User {} icin {} refresh token revoke edildi", userId, n);
    }

    /** Cleanup task — her gece 03:00 (30 günden eski revoked + tüm expired) */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void cleanup() {
        int deleted = repo.deleteExpiredAndRevoked(LocalDateTime.now().minusDays(30));
        if (deleted > 0) log.info("RefreshToken cleanup: {} kayit silindi", deleted);
    }

    // ─── Helpers ───────────────────────────────────────────────

    private String generateRawToken() {
        byte[] bytes = new byte[32];   // 256-bit
        RNG.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            // hex encoding — DB'de 64 char
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algoritmasi yok (JVM hatasi)", e);
        }
    }

    /** Rotation sonucu — yeni access token üretmek için user + new refresh token */
    public record RotationResult(User user, String newRawRefreshToken) {}
}
