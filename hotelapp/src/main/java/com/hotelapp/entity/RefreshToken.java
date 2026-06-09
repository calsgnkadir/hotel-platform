package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * F0.2 — Refresh Token (httpOnly cookie + DB-stored).
 *
 * Güvenlik mantığı:
 *  - Raw token cookie'de gider, SHA-256 hash'i DB'de saklanır
 *    (DB sızsa bile raw token elde edilemez)
 *  - 7 gün geçerli (access token 15 dk)
 *  - revoke flag: logout veya rotation sonrası işaretlenir
 *  - last_used_at: anomali tespiti için
 *  - rotation: her refresh'te eski token revoke edilir, yeni üretilir
 */
@Entity
@Table(name = "refresh_tokens", indexes = {
        @Index(name = "idx_refresh_token_hash", columnList = "token_hash", unique = true),
        @Index(name = "idx_refresh_user", columnList = "user_id"),
        @Index(name = "idx_refresh_expires", columnList = "expires_at"),
})
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** SHA-256 hash of the raw token — raw token sadece cookie'de gider, asla DB'de değil */
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** Logout veya rotation sonrası true. Revoked token tekrar geldiğinde alarm */
    @Column(nullable = false)
    @Builder.Default
    private boolean revoked = false;

    @Column(name = "last_used_at")
    private LocalDateTime lastUsedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public boolean isExpired() {
        return expiresAt.isBefore(LocalDateTime.now());
    }

    public boolean isValid() {
        return !revoked && !isExpired();
    }
}
