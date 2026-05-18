package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * İşletme galeri fotoğrafı (logo değil — logo Business.logoPath'te).
 * Bir işletmenin birden fazla galeri fotoğrafı olabilir.
 */
@Entity
@Table(name = "business_photos")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusinessPhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    // Disk üzerindeki relative path: "business/{businessId}/gallery/{uuid}_{name}"
    @Column(nullable = false)
    private String filePath;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
