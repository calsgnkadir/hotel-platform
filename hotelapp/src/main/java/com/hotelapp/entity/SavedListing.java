package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Dalga H1 — Aday'in kaydettigi (favori) ilanlar
 *
 * Kariyer.net'in "Kaydettiklerim" sekmesinin esdegeri.
 * Aday daha sonra geri donmek istedigi ilanlari isaretler.
 *
 * Unique: bir aday ayni ilani bir kez kaydeder
 * Cascade: aday silinince -> kaydettikleri silinir
 */
@Entity
@Table(name = "saved_listings",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_listing",
                columnNames = { "user_id", "job_listing_id" }),
        indexes = {
            @Index(name = "idx_saved_user",    columnList = "user_id"),
            @Index(name = "idx_saved_listing", columnList = "job_listing_id"),
        })
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SavedListing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_listing_id", nullable = false)
    private JobListing jobListing;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
