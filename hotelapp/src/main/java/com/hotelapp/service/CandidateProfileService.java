package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.EducationLevel;
import com.hotelapp.enums.Gender;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.Language;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.ReviewRepository;
import com.hotelapp.repository.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import com.hotelapp.validation.AdultAge;
import com.hotelapp.validation.TurkeyPhone;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CandidateProfileService {

    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final ApplicationRepository applicationRepository;
    private final ReviewRepository reviewRepository;
    private final ReliabilityService reliabilityService;

    // ----------------------------------------------------------------
    // Read own profile
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public CandidateProfileDto getMyProfile(Long candidateId) {
        User user = userRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", candidateId));
        return toDto(user);
    }

    // ----------------------------------------------------------------
    // Update own profile
    // email, role, isStudent, strikesRemaining DEĞİŞTİRİLMEZ (auth/admin alanı)
    // ----------------------------------------------------------------
    @Transactional
    public CandidateProfileDto updateMyProfile(Long candidateId, ProfileUpdateRequest req) {
        User user = userRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", candidateId));

        // Core editable
        user.setFullName(req.getFullName());
        user.setPhone(req.getPhone());

        // Candidate profile fields
        user.setDistrict(req.getDistrict());
        user.setNeighborhood(req.getNeighborhood());
        user.setBirthDate(req.getBirthDate());
        user.setGender(req.getGender());
        user.setEducation(req.getEducation());
        user.setLanguages(req.getLanguages() != null
                ? new HashSet<>(req.getLanguages())
                : new HashSet<>());
        user.setAvailabilityTypes(req.getAvailabilityTypes() != null
                ? new HashSet<>(req.getAvailabilityTypes())
                : new HashSet<>());
        user.setPreviousExperience(req.getPreviousExperience());
        user.setSmokes(req.getSmokes());
        user.setHasLicense(req.getHasLicense());

        // ADIM J: bildirim tercihleri
        user.setPreferredDistricts(req.getPreferredDistricts() != null
                ? new HashSet<>(req.getPreferredDistricts())
                : new HashSet<>());
        user.setPreferredPositions(req.getPreferredPositions() != null
                ? new HashSet<>(req.getPreferredPositions())
                : new HashSet<>());

        userRepository.save(user);
        return toDto(user);
    }

    // ----------------------------------------------------------------
    // Avatar yükle/sil (D7)
    // ----------------------------------------------------------------
    @Transactional
    public CandidateProfileDto uploadAvatar(Long candidateId, MultipartFile file) {
        User user = userRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", candidateId));

        // Eski avatar varsa Cloudinary'den sil
        if (user.getAvatarPath() != null) {
            fileStorageService.delete(user.getAvatarPath());
        }

        String ref = fileStorageService.storeAvatar(file, candidateId);
        user.setAvatarPath(ref);
        userRepository.save(user);
        return toDto(user);
    }

    @Transactional
    public void deleteAvatar(Long candidateId) {
        User user = userRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", candidateId));
        if (user.getAvatarPath() != null) {
            fileStorageService.delete(user.getAvatarPath());
            user.setAvatarPath(null);
            userRepository.save(user);
        }
    }

    // ----------------------------------------------------------------
    // Mapping
    // ----------------------------------------------------------------
    private CandidateProfileDto toDto(User u) {
        // F0.13 — open-in-view:false ile uyumlu: lazy collection'lari transaction
        // ICINDE initialize edip kopyala (Jackson serialize ederken proxy patlamasin).
        return CandidateProfileDto.builder()
                .id(u.getId())
                .email(u.getEmail())
                .fullName(u.getFullName())
                .phone(u.getPhone())
                .role(u.getRole().name())
                .isStudent(u.isStudent())
                .district(u.getDistrict())
                .neighborhood(u.getNeighborhood())
                .birthDate(u.getBirthDate())
                .gender(u.getGender())
                .education(u.getEducation())
                .languages(u.getLanguages() != null ? new HashSet<>(u.getLanguages()) : new HashSet<>())
                .availabilityTypes(u.getAvailabilityTypes() != null ? new HashSet<>(u.getAvailabilityTypes()) : new HashSet<>())
                .previousExperience(u.getPreviousExperience())
                .smokes(u.getSmokes())
                .hasLicense(u.getHasLicense())
                .avatarUrl(u.getAvatarPath() != null
                        ? fileStorageService.publicUrl(u.getAvatarPath())
                        : null)
                .preferredDistricts(u.getPreferredDistricts() != null ? new HashSet<>(u.getPreferredDistricts()) : new HashSet<>())
                .preferredPositions(u.getPreferredPositions() != null ? new HashSet<>(u.getPreferredPositions()) : new HashSet<>())
                .build();
    }

    // ----------------------------------------------------------------
    // PUBLIC PROFILE — isletme adayin profilini gorebilsin (sadece ilan
    // basvurusu yapilmissa). Hassas alanlar (email/telefon/adres/dogum)
    // ASLA DTO'da yok.
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public PublicCandidateProfileDto getPublicProfile(Long candidateId, Long viewerId) {
        User candidate = userRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Aday", candidateId));
        if (candidate.getRole() != Role.CANDIDATE) {
            throw new ResourceNotFoundException("Aday", candidateId);
        }

        User viewer = userRepository.findById(viewerId)
                .orElseThrow(() -> new AccessDeniedException("Yetki yok"));

        // Dalga G2 — Politika
        // - Temel bilgiler (ad/avatar/ilce/pozisyon/guvenilirlik) HERKESE acik
        // - Hassas (email/phone/adres tam/dogum) sadece:
        //   a) Aday kendi profili icin (viewer == candidate)
        //   b) Isletme + aday bu isletmenin ilanina basvurmus
        //   c) Admin
        boolean canSeeSensitive = false;
        if (viewer.getRole() == Role.ADMIN) {
            canSeeSensitive = true;
        } else if (viewer.getId().equals(candidateId)) {
            canSeeSensitive = true;
        } else if (viewer.getRole() == Role.BUSINESS_OWNER) {
            // Dalga G2 — sadece KABUL EDILMIS (calismis) basvurusu varsa hassas alanlar acilir
            canSeeSensitive = applicationRepository
                    .existsByCandidateIdAndJobListingBusinessOwnerIdAndStatus(
                            candidateId, viewerId, ApplicationStatus.ACCEPTED);
        }

        // Guvenilirlik + sayilar
        ReliabilityService.ReliabilityScore reliability =
                reliabilityService.computeForCandidate(candidateId);
        long completedJobs = applicationRepository
                .countByCandidateIdAndStatusAndNoShowFalse(candidateId, ApplicationStatus.ACCEPTED);
        long noShows = applicationRepository.countByCandidateIdAndNoShowTrue(candidateId);

        // Aday'in aldigi rating'ler (isletme -> aday)
        Object[] ratingAgg = reviewRepository.aggregateForCandidate(candidateId);
        Double avgRating = null;
        Long reviewCount = 0L;
        if (ratingAgg != null && ratingAgg.length >= 2 && ratingAgg[1] != null) {
            avgRating  = ratingAgg[0] != null ? ((Number) ratingAgg[0]).doubleValue() : null;
            reviewCount = ((Number) ratingAgg[1]).longValue();
        }

        return PublicCandidateProfileDto.builder()
                .id(candidate.getId())
                .fullName(candidate.getFullName())
                .avatarUrl(candidate.getAvatarPath() != null
                        ? fileStorageService.publicUrl(candidate.getAvatarPath())
                        : null)
                .district(candidate.getDistrict())
                .education(candidate.getEducation())
                .preferredPositions(candidate.getPreferredPositions() != null
                        ? new HashSet<>(candidate.getPreferredPositions()) : new HashSet<>())
                .availabilityTypes(candidate.getAvailabilityTypes() != null
                        ? new HashSet<>(candidate.getAvailabilityTypes()) : new HashSet<>())
                .languages(candidate.getLanguages() != null
                        ? new HashSet<>(candidate.getLanguages()) : new HashSet<>())
                .previousExperience(candidate.getPreviousExperience())
                .smokes(candidate.getSmokes())
                .hasLicense(candidate.getHasLicense())
                .reliabilityScore(reliability != null ? reliability.getScore() : null)
                .reliabilityTier(reliability != null && reliability.getScore() != null
                        ? (reliability.getScore() >= 70 ? "HIGH"
                          : reliability.getScore() >= 40 ? "MEDIUM" : "LOW")
                        : null)
                .completedJobs(completedJobs)
                .noShowCount(noShows)
                .averageRating(avgRating)
                .reviewCount(reviewCount)
                .memberSince(candidate.getCreatedAt())
                // Hassas alanlar — sadece yetkili viewer icin doldur, aksi takdirde null
                .email(canSeeSensitive ? candidate.getEmail() : null)
                .phone(canSeeSensitive ? candidate.getPhone() : null)
                .neighborhood(canSeeSensitive ? candidate.getNeighborhood() : null)
                .birthDate(canSeeSensitive ? candidate.getBirthDate() : null)
                .gender(canSeeSensitive ? candidate.getGender() : null)
                .sensitiveUnlocked(canSeeSensitive)
                .build();
    }

    // ----------------------------------------------------------------
    // DTOs
    // ----------------------------------------------------------------
    @Data @Builder
    public static class CandidateProfileDto {
        // Readonly identity
        private Long id;
        private String email;
        private String role;
        private Boolean isStudent;

        // Editable
        private String fullName;
        private String phone;
        private String district;
        private String neighborhood;
        private LocalDate birthDate;
        private Gender gender;
        private EducationLevel education;
        private Set<Language> languages;
        private Set<JobType> availabilityTypes;
        private String previousExperience;
        private Boolean smokes;
        private Boolean hasLicense;

        // D7: Profil fotoğrafı URL'si (Cloudinary CDN)
        private String avatarUrl;

        // ADIM J: Bildirim tercihleri
        private Set<String> preferredDistricts;
        private Set<Position> preferredPositions;
    }

    /**
     * Dalga G — Aday public profili. Email/telefon/adres/dogum tarihi YOK.
     * Yetki: sadece ilgili isletme (aday bu isletmeye basvurmus) veya admin.
     */
    @Data @Builder
    public static class PublicCandidateProfileDto {
        private Long id;
        private String fullName;
        private String avatarUrl;
        private String district;          // sadece ilce, mahalle yok
        private EducationLevel education;
        private Set<Position> preferredPositions;
        private Set<JobType> availabilityTypes;
        private Set<Language> languages;
        private String previousExperience;
        private Boolean smokes;
        private Boolean hasLicense;

        // Guvenilirlik metrikleri
        private Integer reliabilityScore;
        private String  reliabilityTier;  // HIGH/MEDIUM/LOW
        private Long    completedJobs;    // kabul + no-show degil
        private Long    noShowCount;
        private Double  averageRating;
        private Long    reviewCount;

        private LocalDateTime memberSince;

        // Dalga G2 — Hassas alanlar (sadece yetkili viewer icin dolu, digerinde null)
        private String  email;
        private String  phone;
        private String  neighborhood;     // ilce zaten public; mahalle hassas
        private LocalDate birthDate;
        private Gender  gender;
        private Boolean sensitiveUnlocked; // true ise hassas alanlar dolu
    }

    @Data
    public static class ProfileUpdateRequest {
        @NotBlank(message = "Ad soyad zorunlu")
        private String fullName;

        @TurkeyPhone(mobileOnly = true, message = "Geçerli bir cep telefonu girin (örn: 0555 123 45 67)")
        private String phone;

        private String district;
        private String neighborhood;

        @AdultAge(min = 16, max = 65, message = "Yaşınız 16-65 aralığında olmalı")
        private LocalDate birthDate;

        private Gender gender;
        private EducationLevel education;
        private Set<Language> languages;
        private Set<JobType> availabilityTypes;
        private String previousExperience;
        private Boolean smokes;
        private Boolean hasLicense;

        // ADIM J: Bildirim tercihleri (opsiyonel)
        private Set<String> preferredDistricts;
        private Set<Position> preferredPositions;
    }
}
