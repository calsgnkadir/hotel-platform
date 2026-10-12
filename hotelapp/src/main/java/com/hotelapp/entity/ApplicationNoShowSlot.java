package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Vardiya bazinda "gelmedi" isareti. Sema: V25__application_no_show_slots.sql.
 *
 * <p>Isaretlenen vardiya basvurudan CIKMAZ (calisilmis diger vardiyalar ve kazanc
 * korunur); koltuk bosaltilir, giris reddedilir, kart uretilmez, yoklamada
 * "Gelmedi" gorunur. Unique (application_id, shift_slot_id): ayni vardiya iki kez
 * isaretlenemez — cift ceza / cift koltuk bosaltma DB seviyesinde de engellenir.
 */
@Entity
@Table(name = "application_no_show_slots",
        uniqueConstraints = @UniqueConstraint(name = "uk_anss_application_slot",
                columnNames = { "application_id", "shift_slot_id" }),
        indexes = @Index(name = "idx_anss_slot", columnList = "shift_slot_id"))
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApplicationNoShowSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "application_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_anss_application"))
    private Application application;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shift_slot_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_anss_slot"))
    private ShiftSlot shiftSlot;

    @Column(name = "marked_at", nullable = false)
    private LocalDateTime markedAt;

    @PrePersist
    protected void onCreate() {
        if (markedAt == null) markedAt = LocalDateTime.now();
    }
}
