package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * FAZ 4.4 — Email dogrulama token'i (PasswordResetToken pattern).
 *
 * Akis:
 *   1) Register sonrasi yeni token + email gonderilir.
 *   2) Kullanici "Dogrula" linkine tiklar.
 *   3) Backend token'i validate eder, user.emailVerifiedAt set eder, token used_at isaretler.
 *   4) Mevcut tum aktif token'lar her yeni gondermede invalidate edilir.
 */
@Entity
@Table(name = "email_verification_tokens", indexes = {
        @Index(name = "idx_evt_token", columnList = "token", unique = true),
        @Index(name = "idx_evt_user",  columnList = "user_id")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailVerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    private LocalDateTime usedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public boolean isExpired() { return LocalDateTime.now().isAfter(expiresAt); }
    public boolean isUsed()    { return usedAt != null; }
    public boolean isValid()   { return !isExpired() && !isUsed(); }
}
