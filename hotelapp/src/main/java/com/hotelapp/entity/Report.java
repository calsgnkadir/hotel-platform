package com.hotelapp.entity;

import com.hotelapp.enums.ReportReason;
import com.hotelapp.enums.ReportStatus;
import com.hotelapp.enums.ReportType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * D8: Kullanıcı şikayeti.
 * Aday/işletme bir ilanı, işletmeyi veya kullanıcıyı raporlar.
 * Admin inceler, gerekirse ilgili kullanıcıyı banlar.
 */
@Entity
@Table(name = "reports")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Şikayeti yapan kullanıcı
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reporter_id", nullable = false)
    private User reporter;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReportType targetType;

    // Şikayet edilen varlığın id'si (ilan/işletme/kullanıcı id)
    @Column(nullable = false)
    private Long targetId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReportReason reason;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ReportStatus status = ReportStatus.PENDING;

    // Admin notu (inceleme sonrası)
    @Column(columnDefinition = "TEXT")
    private String adminNote;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime reviewedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (status == null) status = ReportStatus.PENDING;
    }
}
