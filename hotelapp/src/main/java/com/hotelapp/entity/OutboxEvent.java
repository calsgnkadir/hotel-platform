package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * FAZ C.2 — Transactional Outbox event row.
 *
 * Domain mutation ile ayni TX icinde yazilir. OutboxRelay scheduler
 * processed_at IS NULL olanlari okur, handler'a yonlendirir, isaretler.
 * At-least-once teslim — handler idempotent olmali.
 */
@Entity
@Table(name = "outbox_events", indexes = {
        @Index(name = "idx_outbox_pending", columnList = "processed_at, created_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", length = 64, nullable = false)
    private String eventType;

    /** JSON payload — Jackson serialize edilmis event record. */
    @Lob
    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** null = pending, NOT NULL = teslim edildi. */
    @Column(name = "processed_at")
    private LocalDateTime processedAt;

    @Column(nullable = false)
    private Integer attempts;

    @Column(name = "last_error", length = 500)
    private String lastError;
}
