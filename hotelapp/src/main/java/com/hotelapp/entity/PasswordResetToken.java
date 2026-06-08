package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * #80: Email tabanlı şifre sıfırlama token'ı.
 *
 * Akış:
 *   1) Kullanıcı /forgot-password'a email girer
 *   2) Backend bu kayıttan bir tane oluşturur (UUID + 1 saat geçerli)
 *   3) Email ile link gönderilir: APP_BASE_URL/reset-password?token=...
 *   4) Kullanıcı yeni şifre girer → confirm endpoint'i token'ı kontrol eder
 *      ve şifreyi günceller, token'ı usedAt ile işaretler (tek kullanımlık)
 */
@Entity
@Table(name = "password_reset_tokens", indexes = {
        @Index(name = "idx_prt_token", columnList = "token", unique = true),
        @Index(name = "idx_prt_user",  columnList = "user_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Email link'inde gönderilen UUID. */
    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    /** null = henüz kullanılmadı, dolu = bu zamanda tüketildi. */
    private LocalDateTime usedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    public boolean isUsed() {
        return usedAt != null;
    }

    public boolean isValid() {
        return !isExpired() && !isUsed();
    }
}
