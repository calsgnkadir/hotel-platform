package com.hotelapp.entity;

import com.hotelapp.enums.EducationLevel;
import com.hotelapp.enums.Gender;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.Language;
import com.hotelapp.enums.Role;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
// FAZ 9.2 — N+1 fix: Application.candidate/Business.owner LAZY yuklendiginde
// Hibernate 50 user'i tek IN(...) sorgusuyla toplar. Application list'lerinde
// (getBusinessApplications, getMyApplications) 20 user -> 1 sorgu.
@BatchSize(size = 50)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    /**
     * Şifre — local kayıtlı kullanıcılar için BCrypt hash.
     * OAuth (Google) kullanıcıları için null olabilir (provider != LOCAL).
     */
    private String password;

    /**
     * #92: Hesap nereden geldi — local form veya OAuth provider.
     * Default LOCAL (mevcut kullanıcılar etkilenmesin).
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private com.hotelapp.enums.AuthProvider provider = com.hotelapp.enums.AuthProvider.LOCAL;

    /** Provider tarafındaki user ID (Google: sub claim, ~21 char). */
    @Column(length = 100)
    private String providerId;

    @Column(nullable = false)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    private String phone;

    // Set to true only when admin verifies student document
    @Column(nullable = false)
    @Builder.Default
    private boolean isStudent = false;

    // 3 strikes for regular candidates, 5 when isStudent=true is granted
    @Column(nullable = false)
    @Builder.Default
    private int strikesRemaining = 3;

    // Null means not banned
    private LocalDateTime bannedUntil;

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    /**
     * FAZ 4.4 — Email dogrulamasi yapildigi an. null = henuz dogrulanmadi.
     * OAuth kullanicilari (provider != LOCAL) icin otomatik dolu kabul edilir
     * (helper isEmailVerified() kontrolu yapar).
     */
    private LocalDateTime emailVerifiedAt;

    /**
     * FAZ D.8 — KVKK soft delete.
     * deletionRequestedAt set + enabled=false: kullanici hesap silme istegi yapti.
     * scheduledAnonymizeAt: bu tarihten sonra @Scheduled anonymize eder
     * (PII alanlari "deleted-{id}@deleted.local" gibi maskelenir).
     * 30 gun grace: aralikta kullanici destek hattindan recovery isteyebilir.
     */
    private LocalDateTime deletionRequestedAt;
    private LocalDateTime scheduledAnonymizeAt;

    /** FAZ 4.4 — Email dogrulanmis mi? OAuth icin daima true. */
    public boolean isEmailVerified() {
        return emailVerifiedAt != null
                || (provider != null && provider != com.hotelapp.enums.AuthProvider.LOCAL);
    }

    // ================================================================
    // CANDIDATE PROFILE FIELDS (Faz C1)
    // BUSINESS_OWNER kullanıcılarda bu alanlar boş kalır.
    // ================================================================

    private String district;              // İstanbul içi ilçe
    private String neighborhood;           // İstanbul içi mahalle (ilçeye bağlı)
    private LocalDate birthDate;

    @Enumerated(EnumType.STRING)
    private Gender gender;

    @Enumerated(EnumType.STRING)
    private EducationLevel education;

    @ElementCollection(targetClass = Language.class)
    @Enumerated(EnumType.STRING)
    @CollectionTable(
        name = "user_languages",
        joinColumns = @JoinColumn(name = "user_id")
    )
    @Column(name = "language")
    @Builder.Default
    private Set<Language> languages = new HashSet<>();

    @ElementCollection(targetClass = JobType.class)
    @Enumerated(EnumType.STRING)
    @CollectionTable(
        name = "user_availability_types",
        joinColumns = @JoinColumn(name = "user_id")
    )
    @Column(name = "availability_type")
    @Builder.Default
    private Set<JobType> availabilityTypes = new HashSet<>();

    /** ADIM J: Aday'ın iş bildirimi için ilgilendiği ilçeler */
    @ElementCollection
    @CollectionTable(
        name = "user_preferred_districts",
        joinColumns = @JoinColumn(name = "user_id")
    )
    @Column(name = "district", length = 50)
    @Builder.Default
    private Set<String> preferredDistricts = new HashSet<>();

    /** ADIM J: Aday'ın iş bildirimi için ilgilendiği pozisyonlar */
    @ElementCollection(targetClass = com.hotelapp.enums.Position.class)
    @Enumerated(EnumType.STRING)
    @CollectionTable(
        name = "user_preferred_positions",
        joinColumns = @JoinColumn(name = "user_id")
    )
    @Column(name = "position", length = 30)
    @Builder.Default
    private Set<com.hotelapp.enums.Position> preferredPositions = new HashSet<>();

    @Column(columnDefinition = "TEXT")
    private String previousExperience;    // Serbest text — önceki iş deneyimi

    // Boolean (nullable): null = belirtilmemiş, true/false = cevap verildi
    private Boolean smokes;
    private Boolean hasLicense;

    // Dalga H2 — Is ariyorum toggle (LinkedIn Open to Work pattern)
    // null = belirtilmemis, true = aktif arayisi, false = simdilik kapali
    // Aday Profilim'de switch ile yonetir, isletme aramada filtre olarak kullanabilir
    @Column(name = "is_available")
    @Builder.Default
    private Boolean isAvailable = true;

    // Profil fotoğrafı — Cloudinary storage ref (D7)
    // Format: "upload:image:ajanshotel/avatars/{userId}/{uuid}.jpg"
    private String avatarPath;

    // ================================================================

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
