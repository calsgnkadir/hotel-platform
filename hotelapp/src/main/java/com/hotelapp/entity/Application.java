package com.hotelapp.entity;

import com.hotelapp.enums.ApplicationStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "applications")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private User candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_listing_id", nullable = false)
    private JobListing jobListing;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ApplicationStatus status = ApplicationStatus.PENDING;

    @Column(columnDefinition = "TEXT")
    private String coverLetter;

    // Auto-set to 1 week from creation
    @Column(nullable = false)
    private LocalDateTime deadline;

    // Note from business owner on accept/reject
    private String note;

    // True if candidate accepted but didn't show up (triggers strike deduction — Phase D)
    @Column(nullable = false)
    @Builder.Default
    private boolean noShow = false;

    @Column(nullable = false)
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime reviewedAt;

    // FAZ 2/#28 — Direkt rezervasyon / HOLD
    // Isletme HOLD'a aldiginda aday 24 saat icinde Onayla/Reddet secmeli.
    // Cevap yoksa scheduler EXPIRED'a cevirir.
    private LocalDateTime holdDeadline;

    // Faz E1 öncesi: keyfi haftalık müsaitlik. Yeni akış slot kullanır;
    // bu liste eski başvurularda kalır ama yeni başvurularda boş kalır.
    // FAZ 9.2 — N+1 fix: BatchSize ile 50 app'in availability'sini tek IN(...) sorgusuyla topla.
    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @BatchSize(size = 50)
    @Builder.Default
    private List<Availability> availabilities = new ArrayList<>();

    // Faz E1: Adayın başvurduğu spesifik vardiya slotları (ManyToMany)
    // FAZ 9.2 — N+1 fix: BatchSize
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "application_shift_slots",
        joinColumns = @JoinColumn(name = "application_id"),
        inverseJoinColumns = @JoinColumn(name = "shift_slot_id")
    )
    @BatchSize(size = 50)
    @Builder.Default
    private Set<ShiftSlot> requestedSlots = new HashSet<>();

    // FAZ 9.2 — N+1 fix: BatchSize
    @OneToMany(mappedBy = "application", cascade = CascadeType.ALL, orphanRemoval = true)
    @BatchSize(size = 50)
    @Builder.Default
    private List<DocumentRequest> documentRequests = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (deadline == null) {
            deadline = LocalDateTime.now().plusDays(7);
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
