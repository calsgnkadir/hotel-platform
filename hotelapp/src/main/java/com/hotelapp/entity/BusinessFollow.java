package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Dalga I1 — Aday isletmeyi takip eder
 *
 * Kariyer.net 'Takip Ettigin Sirketler' esdegeri.
 * Aday isletmeyi takip ederse yeni ilan acildiginda bildirim alir.
 *
 * Unique: bir aday ayni isletmeyi bir kez takip eder
 */
@Entity
@Table(name = "business_follows",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_business_follow",
                columnNames = { "user_id", "business_id" }),
        indexes = {
            @Index(name = "idx_bf_user",     columnList = "user_id"),
            @Index(name = "idx_bf_business", columnList = "business_id"),
        })
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusinessFollow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
