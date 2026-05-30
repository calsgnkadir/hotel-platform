package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * ADIM 10: Karşılıklı puanlama.
 * Bir başvuru üzerinde aday ve işletme birbirini puanlar.
 * Her başvuru için her yönde EN FAZLA 1 yorum (unique constraint).
 *
 * byRole = "CANDIDATE" → aday işletmeyi puanladı
 * byRole = "BUSINESS"  → işletme adayı puanladı
 */
@Entity
@Table(name = "reviews",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_review_application_role",
                columnNames = {"application_id", "by_role"}
        ))
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Review {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @Column(name = "by_role", nullable = false, length = 10)
    private String byRole;   // "CANDIDATE" veya "BUSINESS"

    @Column(nullable = false)
    private Integer rating;  // 1-5

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
