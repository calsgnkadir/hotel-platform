package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.enums.EducationLevel;
import com.hotelapp.enums.Gender;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.Language;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.UserRepository;
import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CandidateProfileService {

    private final UserRepository userRepository;

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

        userRepository.save(user);
        return toDto(user);
    }

    // ----------------------------------------------------------------
    // Mapping
    // ----------------------------------------------------------------
    private CandidateProfileDto toDto(User u) {
        return CandidateProfileDto.builder()
                .id(u.getId())
                .email(u.getEmail())
                .fullName(u.getFullName())
                .phone(u.getPhone())
                .role(u.getRole().name())
                .isStudent(u.isStudent())
                .district(u.getDistrict())
                .birthDate(u.getBirthDate())
                .gender(u.getGender())
                .education(u.getEducation())
                .languages(u.getLanguages())
                .availabilityTypes(u.getAvailabilityTypes())
                .previousExperience(u.getPreviousExperience())
                .smokes(u.getSmokes())
                .hasLicense(u.getHasLicense())
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
        private boolean isStudent;

        // Editable
        private String fullName;
        private String phone;
        private String district;
        private LocalDate birthDate;
        private Gender gender;
        private EducationLevel education;
        private Set<Language> languages;
        private Set<JobType> availabilityTypes;
        private String previousExperience;
        private Boolean smokes;
        private Boolean hasLicense;
    }

    @Data
    public static class ProfileUpdateRequest {
        @NotBlank(message = "Ad soyad zorunlu")
        private String fullName;

        private String phone;
        private String district;
        private LocalDate birthDate;
        private Gender gender;
        private EducationLevel education;
        private Set<Language> languages;
        private Set<JobType> availabilityTypes;
        private String previousExperience;
        private Boolean smokes;
        private Boolean hasLicense;
    }
}
