package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.DayOfWeek;
import java.time.LocalTime;

/**
 * Faz B/#10 — Aday'ın profil bazlı haftalık müsaitlik bloğu.
 *
 * Mevcut {@link Availability} başvuru-spesifik (her başvuru için ayrı tanımlanır);
 * bu entity ise profil seviyesinde, bir kez doldurulup tüm ilan eşleştirmesinde kullanılır.
 *
 * Örnek: Pzt 09:00-17:00, Cuma 14:00-22:00.
 * Listing slot'ları ile çakışan günler ilan filtresinde "müsaitliğime uygun" pill'ini açar.
 */
@Entity
@Table(name = "user_availability_blocks", indexes = {
        @Index(name = "idx_uab_user", columnList = "user_id")
})
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserAvailabilityBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DayOfWeek dayOfWeek;

    @Column(nullable = false)
    private LocalTime startTime;

    @Column(nullable = false)
    private LocalTime endTime;
}
