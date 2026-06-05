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

    /** Galeri sıralama indeksi — küçükten büyüğe gösterilir. */
    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 0;

    /** Kapak fotoğrafı mı? Her işletmede en fazla 1 tane true olur. */
    @Column(name = "is_cover", nullable = false)
    @Builder.Default
    private Boolean isCover = false;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (displayOrder == null) displayOrder = 0;
        if (isCover == null)      isCover = false;
    }
}
