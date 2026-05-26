package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Faz E1: Bir iş ilanının altındaki spesifik vardiya slotu.
 * İşletme "5 Haziran Cumartesi 08:00-16:00, 2 garson lazım" der.
 * Aday bu slotlara (1 veya birden çok) başvurur.
 */
@Entity
@Table(name = "shift_slots")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShiftSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_listing_id", nullable = false)
    private JobListing jobListing;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private LocalTime endTime;

    /** Bu slot için kaç aday gerekiyor */
    @Column(nullable = false)
    @Builder.Default
    private Integer slotsNeeded = 1;

    /** Şu ana kadar kaç adayın bu slotu kabul edildi (ACCEPTED) */
    @Column(nullable = false)
    @Builder.Default
    private Integer slotsFilled = 0;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (slotsFilled == null) slotsFilled = 0;
        if (slotsNeeded == null) slotsNeeded = 1;
    }

    /** Slot dolu mu? (kapasitesinin altında mı?) */
    public boolean isFull() {
        return slotsFilled != null && slotsNeeded != null && slotsFilled >= slotsNeeded;
    }
}
