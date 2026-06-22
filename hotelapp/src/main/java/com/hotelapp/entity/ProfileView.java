package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Dalga H3 — Aday profili goruntulenme audit'i
 *
 * Kariyer.net 'Ozgecmis Goruntuleme (Son 90 Gun)' esdegeri.
 * CandidatePublicPage hit oldugunda 1 kayit eklenir.
 *
 * Anonymity: viewer_id null OLABILIR (henuz kabul edilmedi) ama duplicate
 * engellemek icin (viewer_id, profile_id, gun) uzerine soft-dedupe service'te.
 */
@Entity
@Table(name = "profile_views",
        indexes = {
            @Index(name = "idx_pv_profile_date", columnList = "profile_id, viewed_at"),
            @Index(name = "idx_pv_viewer",       columnList = "viewer_id"),
        })
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProfileView {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Goruntulenen adayin id'si */
    @Column(name = "profile_id", nullable = false)
    private Long profileId;

    /** Bakan kullanicinin id'si (genelde isletme). null olabilir (anon legacy) */
    @Column(name = "viewer_id")
    private Long viewerId;

    @Column(name = "viewed_at", nullable = false)
    private LocalDateTime viewedAt;

    @PrePersist
    protected void onCreate() {
        if (viewedAt == null) viewedAt = LocalDateTime.now();
    }
}
