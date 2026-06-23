package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Dalga I1 — Aday isletmeyi engeller (Kariyer.net 'Engelledigin Sirketler')
 *
 * Engellenen isletme:
 * - Aday'in ilanlar feed'inde gozukmez
 * - Aday isletmeden bildirim almaz
 * - Esleştirme bildirimleri tetiklenmez
 *
 * Unique: bir aday ayni isletmeyi bir kez engeller
 */
@Entity
@Table(name = "business_blocks",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_business_block",
                columnNames = { "user_id", "business_id" }),
        indexes = {
            @Index(name = "idx_bb_user",     columnList = "user_id"),
            @Index(name = "idx_bb_business", columnList = "business_id"),
        })
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusinessBlock {

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
