package com.hotelapp.entity;

import com.hotelapp.enums.BusinessType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "businesses")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Business {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BusinessType type;

    @Column(nullable = false)
    @Builder.Default
    private String city = "Istanbul";

    private String district;

    private String neighborhood;

    private String address;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String phone;

    private String website;

    // e.g. "5*", "4*", "Boutique" — relevant for hotels
    private String category;

    // Sosyal medya — kullanıcı adı veya tam URL (frontend serbest)
    private String instagram;
    private String facebook;

    // Çalışma saatleri — şimdilik serbest text (B2.3'te yapılandırılacak)
    // Örn: "Pzt-Cuma 09:00-18:00, Cumartesi 10:00-22:00, Pazar kapalı"
    @Column(columnDefinition = "TEXT")
    private String workingHours;

    // Logo dosyasının relative path'i (örn: "business/3/logo/uuid_logo.png")
    // Bytes /api/businesses/{id}/logo endpoint'inden döner.
    private String logoPath;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (city == null) city = "Istanbul";
    }
}
