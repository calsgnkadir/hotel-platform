package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.enums.EducationLevel;
import com.hotelapp.enums.Gender;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.Language;
import com.hotelapp.enums.Position;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.UserRepository;
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
