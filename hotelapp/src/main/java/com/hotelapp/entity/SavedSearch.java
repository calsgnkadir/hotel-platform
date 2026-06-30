package com.hotelapp.entity;

import com.hotelapp.enums.JobType;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Shift;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * FAZ 5 — Kayıtlı arama (LinkedIn'in "Search Alerts" pattern'i).
 * Aday filtreleri kaydeder; SavedSearchScheduler yeni eşleşme çıkarsa bildirim atar.
 */
@Entity
@Table(name = "saved_searches")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class SavedSearch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private Position position;

    @Enumerated(EnumType.STRING)
    @Column(name = "job_type", length = 32)
    private JobType jobType;

    @Column(length = 64)
    private String district;

    @Column(length = 255)
    private String keyword;

    @Column(name = "min_salary", precision = 12, scale = 2)
    private BigDecimal minSalary;

    @Column(name = "date_from")
    private LocalDate dateFrom;

    @Column(name = "date_to")
    private LocalDate dateTo;

    @ElementCollection(targetClass = Shift.class, fetch = FetchType.EAGER)
    @CollectionTable(name = "saved_search_shifts", joinColumns = @JoinColumn(name = "saved_search_id"))
    @Column(name = "shift", length = 16)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Set<Shift> shifts = new HashSet<>();

    @Column(name = "notifications_enabled", nullable = false)
    @Builder.Default
    private boolean notificationsEnabled = true;

    @Column(name = "last_notified_at")
    private LocalDateTime lastNotifiedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
