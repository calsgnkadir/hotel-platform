package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * D4: Denetim kaydı — kim, ne zaman, ne yaptı.
 * Kritik eylemler (ban, no-show, rapor işleme, otomatik ban) buraya yazılır.
 * Aktör SYSTEM olabilir (otomatik tetiklenen eylemler için).
 */
@Entity
@Table(name = "audit_logs")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Eylemi yapan kullanıcı id'si (SYSTEM ise null)
    private Long actorId;

    @Column(nullable = false, length = 120)
    private String actorEmail;   // "SYSTEM" olabilir

    @Column(length = 20)
    private String actorRole;    // ADMIN / BUSINESS_OWNER / CANDIDATE / SYSTEM

    // Eylem kodu: BAN_USER, UNBAN_USER, MARK_NO_SHOW, AUTO_BAN, RESOLVE_REPORT, DISMISS_REPORT
    @Column(nullable = false, length = 40)
    private String action;

    // Hedef tip: USER, APPLICATION, REPORT, LISTING
    @Column(length = 20)
    private String targetType;

    private Long targetId;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
