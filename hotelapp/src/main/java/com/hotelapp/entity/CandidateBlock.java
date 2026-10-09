package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Isletme adayi engeller (BusinessBlock'un ters yonu). Sema: V20__candidate_blocks.sql.
 *
 * Engellenen aday:
 * - Isletmenin ilanlarini gormeye devam eder,
 * - Bu isletmenin ilanlarina basvuramaz,
 * - Isletmeyle sohbet acamaz / mesaj gonderemez.
 * Engel adaya ayrica bildirilmez.
 *
 * Unique: bir isletme ayni adayi bir kez engeller.
 */
@Entity
@Table(name = "candidate_blocks",
        uniqueConstraints = @UniqueConstraint(name = "uk_business_candidate_block",
                columnNames = { "business_id", "candidate_id" }),
        indexes = @Index(name = "idx_cb_candidate", columnList = "candidate_id"))
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CandidateBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "business_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_cb_business"))
    private Business business;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_cb_candidate"))
    private User candidate;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
