package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * FAZ 2/#32 — Talent Pool / Favoriler.
 *
 * Isletme (business) bir adayi (candidate) favorilerine ekler.
 * Unique constraint: bir isletme ayni adayi bir kez favori yapar.
 * Aday silindiginde cascade ile kayit silinir (foreign key SET NULL yok,
 * uzun donem icin User.deletedAt soft-delete yapilirsa burayi yeniden gozden gecir).
 */
@Entity
@Table(name = "business_favorites",
        uniqueConstraints = @UniqueConstraint(name = "uk_business_candidate",
                columnNames = { "business_id", "candidate_id" }),
        indexes = {
            @Index(name = "idx_fav_business", columnList = "business_id"),
            @Index(name = "idx_fav_candidate", columnList = "candidate_id")
        })
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusinessFavorite {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private User candidate;

    /** Isletmenin kendine ozel not (opsiyonel, isletme disinda kimse gormez) */
    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
