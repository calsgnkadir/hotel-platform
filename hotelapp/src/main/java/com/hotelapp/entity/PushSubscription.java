package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * FAZ 1/#23 — Web Push abonelik kaydi.
 * Bir kullanicinin tarayicilardan biri (kac cihaz, kac tarayici varsa).
 * endpoint UNIQUE (ayni tarayici tekrar subscribe edince override).
 */
@Entity
@Table(name = "push_subscriptions",
        indexes = { @Index(name = "idx_push_user", columnList = "user_id") })
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** Push server endpoint (Chrome=fcm.googleapis.com, Firefox=updates.push.services.mozilla.com, ...) */
    @Column(nullable = false, length = 500, unique = true)
    private String endpoint;

    /** Browser-side public key (p256dh) — Base64URL */
    @Column(length = 200)
    private String p256dh;

    /** Browser-side auth secret — Base64URL */
    @Column(length = 100)
    private String authSecret;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
