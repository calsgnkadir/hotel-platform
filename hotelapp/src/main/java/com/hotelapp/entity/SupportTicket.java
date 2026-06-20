package com.hotelapp.entity;

import com.hotelapp.enums.SupportStatus;
import com.hotelapp.enums.SupportSubject;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * FAZ I.5 — Kullanıcı destek bileti.
 *
 * Aday/işletme platform'a yazar (mevcut işletme↔aday mesajlaşmasından
 * AYRI bir kanal). Admin görür, çözer, opsiyonel admin notu bırakır.
 */
@Entity
@Table(name = "support_tickets",
       indexes = {
           @Index(name = "idx_support_user_created", columnList = "user_id, created_at"),
           @Index(name = "idx_support_status",       columnList = "status"),
       })
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupportTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private SupportSubject subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private SupportStatus status = SupportStatus.OPEN;

    /** Admin cevabı (opsiyonel). Status RESOLVED olduğunda doluyor. */
    @Column(name = "admin_note", columnDefinition = "TEXT")
    private String adminNote;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (status == null) status = SupportStatus.OPEN;
    }
}
