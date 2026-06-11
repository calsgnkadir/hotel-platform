package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * FAZ 1/#23 — Web Push subscription kayıtları.
 *
 * Browser her subscribe ettiğinde:
 *  - endpoint: push service URL (Chrome FCM, Firefox Mozilla, vb.)
 *  - p256dh: client public key (P-256 EC)
 *  - auth: client auth secret
 *
 * Aynı kullanıcı birden çok cihazda subscribe olabilir (multi-device).
 * UNIQUE: (user_id, endpoint) — aynı endpoint'i 2 kez kaydetme.
 */
@Entity
@Table(name = "push_subscriptions",
       indexes = {
           @Index(name = "idx_push_user",     columnList = "user_id"),
           @Index(name = "idx_push_endpoint", columnList = "endpoint(255)"),
       },
       uniqueConstraints = {
           @UniqueConstraint(name = "uk_push_user_endpoint", columnNames = {"user_id", "endpoint"}),
       })
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PushSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "endpoint", nullable = false, length = 1024)
    private String endpoint;

    @Column(name = "p256dh", nullable = false, length = 255)
    private String p256dh;

    @Column(name = "auth", nullable = false, length = 64)
    private String auth;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
