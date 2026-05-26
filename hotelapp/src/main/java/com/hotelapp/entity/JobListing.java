package com.hotelapp.entity;

import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Shift;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "job_listings")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobListing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Position position;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private JobType jobType;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String description;

    @Column(columnDefinition = "TEXT")
    private String requirements;

    private BigDecimal salaryMin;
    private BigDecimal salaryMax;

    // For seasonal/daily jobs
    private LocalDate startDate;
    private LocalDate endDate;

    private LocalTime shiftStart;
    private LocalTime shiftEnd;

    // Vardiya kategorisi (MORNING/EVENING/NIGHT) — yeni ilanlar için zorunlu (DTO'da @NotNull),
    // eski ilanlarda NULL kalabilir (geriye uyumluluk için entity'de nullable).
    @Enumerated(EnumType.STRING)
    private Shift shift;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ListingStatus status = ListingStatus.ACTIVE;

    // Faz E1: Bu ilana ait spesifik vardiya slotları (date+startTime+endTime+slotsNeeded)
    @OneToMany(mappedBy = "jobListing", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ShiftSlot> shiftSlots = new ArrayList<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
