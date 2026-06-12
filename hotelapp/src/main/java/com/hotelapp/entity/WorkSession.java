package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * FAZ 2/#21 — Geo-fenced clock-in.
 *
 * Aday kabul edildigi bir basvurunun isinde "mesaiye basla" basinca
 * bir WorkSession acilir. "Mesaiyi bitir" ile kapanir.
 * GPS koordinatlari kayit edilir (denetim icin).
 *
 * Bir aday icin ayni anda 1 acik session olabilir (clockOutAt null).
 */
@Entity
@Table(name = "work_sessions",
        indexes = {
            @Index(name = "idx_ws_app", columnList = "application_id"),
            @Index(name = "idx_ws_open", columnList = "application_id,clock_out_at")
        })
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WorkSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", nullable = false)
    private Application application;

    @Column(nullable = false)
    private LocalDateTime clockInAt;

    @Column(precision = 10, scale = 7)
    private BigDecimal clockInLat;

    @Column(precision = 10, scale = 7)
    private BigDecimal clockInLng;

    /** Mesafe metre cinsinden (denetim/admin kontrolu icin saklanir) */
    private Integer clockInDistanceMeters;

    private LocalDateTime clockOutAt;

    @Column(precision = 10, scale = 7)
    private BigDecimal clockOutLat;

    @Column(precision = 10, scale = 7)
    private BigDecimal clockOutLng;

    private Integer clockOutDistanceMeters;
}
