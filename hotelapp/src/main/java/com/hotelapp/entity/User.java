package com.hotelapp.entity;

import com.hotelapp.enums.EducationLevel;
import com.hotelapp.enums.Gender;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.Language;
import com.hotelapp.enums.Role;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

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

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired()     { return true; }

    @Override
    public boolean isAccountNonLocked()      { return bannedUntil == null || bannedUntil.isBefore(LocalDateTime.now()); }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled()               { return enabled; }
}
