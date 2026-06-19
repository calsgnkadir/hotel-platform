package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.enums.DocumentType;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.DocumentRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.UserRepository;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final BusinessRepository businessRepository;
    private final JobListingRepository jobListingRepository;
    private final ApplicationRepository applicationRepository;
    private final DocumentRepository documentRepository;

    // ================================================================
    // Listing & detail
    // ================================================================

    @Transactional(readOnly = true)
    public List<UserSummary> listUsers(Role role, String search) {
        return userRepository.searchUsers(role, search).stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserDetail getUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", id));

        boolean hasStudentDoc = documentRepository
                .findByStudentIdAndType(user.getId(), DocumentType.STUDENT_CERTIFICATE)
                .isPresent();

        long applicationCount = applicationRepository.findAllByCandidateId(user.getId()).size();
        long listingCount = jobListingRepository.findAllByBusiness_OwnerId(user.getId()).size();

        return UserDetail.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .role(user.getRole().name())
                .isStudent(user.isStudent())
                .strikesRemaining(user.getStrikesRemaining())
                .bannedUntil(user.getBannedUntil())
                .currentlyBanned(isBanned(user))
                .createdAt(user.getCreatedAt())
                .district(user.getDistrict())
                .hasStudentDoc(hasStudentDoc)
                .applicationCount(applicationCount)
                .listingCount(listingCount)
                .build();
    }

    // ================================================================
    // Actions
    // ================================================================

    @Transactional
    public UserSummary setStudentStatus(Long id, boolean approved) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", id));
        if (user.getRole() != Role.CANDIDATE) {
            throw new BusinessRuleException("Sadece CANDIDATE rolündeki kullanıcılar için öğrenci onayı verilir.");
        }
        user.setStudent(approved);
        // Onaylı öğrenci 5 strike, normal aday 3 strike (kural)
        user.setStrikesRemaining(approved ? 5 : 3);
        userRepository.save(user);
        return toSummary(user);
    }

    @Transactional
    public UserSummary ban(Long id, int days) {
        if (days < 1 || days > 365) {
            throw new BusinessRuleException("Ban süresi 1-365 gün aralığında olmalı.");
        }
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", id));
        if (user.getRole() == Role.ADMIN) {
            throw new BusinessRuleException("Admin kullanıcı banlanamaz.");
        }
        user.setBannedUntil(LocalDateTime.now().plusDays(days));
        userRepository.save(user);
        return toSummary(user);
    }

    @Transactional
    public UserSummary unban(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", id));
        user.setBannedUntil(null);
        userRepository.save(user);
        return toSummary(user);
    }

    // ================================================================
    // Stats
    // ================================================================

    @Transactional(readOnly = true)
    public StatsDto getStats() {
        return StatsDto.builder()
                .totalUsers(userRepository.count())
                .candidates(userRepository.countByRole(Role.CANDIDATE))
                .businessOwners(userRepository.countByRole(Role.BUSINESS_OWNER))
                .admins(userRepository.countByRole(Role.ADMIN))
                .bannedUsers(userRepository.countCurrentlyBanned(LocalDateTime.now()))
                .totalBusinesses(businessRepository.count())
                .totalListings(jobListingRepository.count())
                .totalApplications(applicationRepository.count())
                .build();
    }

    // ================================================================
    // Mapping
    // ================================================================

    private UserSummary toSummary(User u) {
        return UserSummary.builder()
                .id(u.getId())
                .email(u.getEmail())
                .fullName(u.getFullName())
                .role(u.getRole().name())
                .isStudent(u.isStudent())
                .strikesRemaining(u.getStrikesRemaining())
                .bannedUntil(u.getBannedUntil())
                .currentlyBanned(isBanned(u))
                .createdAt(u.getCreatedAt())
                .build();
    }

    private boolean isBanned(User u) {
        return u.getBannedUntil() != null && u.getBannedUntil().isAfter(LocalDateTime.now());
    }

    // ================================================================
    // DTOs / requests
    // ================================================================

    @Data @Builder
    public static class UserSummary {
        private Long id;
        private String email;
        private String fullName;
        private String role;
        // Boolean (wrapper) primitive değil — Jackson "isStudent" olarak serialize etsin
        private Boolean isStudent;
        private Integer strikesRemaining;
        private LocalDateTime bannedUntil;
        private Boolean currentlyBanned;
        private LocalDateTime createdAt;
    }

    @Data @Builder
    public static class UserDetail {
        private Long id;
        private String email;
        private String fullName;
        private String phone;
        private String role;
        private Boolean isStudent;
        private Integer strikesRemaining;
        private LocalDateTime bannedUntil;
        private Boolean currentlyBanned;
        private LocalDateTime createdAt;
        private String district;
        private Boolean hasStudentDoc;
        private long applicationCount;
        private long listingCount;
    }

    @Data @Builder
    public static class StatsDto {
        private long totalUsers;
        private long candidates;
        private long businessOwners;
        private long admins;
        private long bannedUsers;
        private long totalBusinesses;
        private long totalListings;
        private long totalApplications;
    }

    @Data
    public static class StudentStatusRequest {
        @NotNull private Boolean approved;
    }

    @Data
    public static class BanRequest {
        @NotNull @Min(1) private Integer days;
    }

    // ================================================================
    // FAZ 6.3 — Listing moderation (admin)
    // ================================================================

    @Transactional(readOnly = true)
    public List<AdminListingDto> listListingsForAdmin(com.hotelapp.enums.ListingStatus status, String search) {
        var stream = jobListingRepository.findAll().stream();
        if (status != null) {
            stream = stream.filter(l -> l.getStatus() == status);
        }
        if (search != null && !search.isBlank()) {
            String q = search.trim().toLowerCase();
            stream = stream.filter(l ->
                (l.getTitle() != null && l.getTitle().toLowerCase().contains(q)) ||
                (l.getBusiness() != null && l.getBusiness().getName() != null
                    && l.getBusiness().getName().toLowerCase().contains(q))
            );
        }
        return stream
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .limit(200)
            .map(l -> AdminListingDto.builder()
                .id(l.getId())
                .title(l.getTitle())
                .position(l.getPosition() != null ? l.getPosition().name() : null)
                .status(l.getStatus().name())
                .businessId(l.getBusiness() != null ? l.getBusiness().getId() : null)
                .businessName(l.getBusiness() != null ? l.getBusiness().getName() : null)
                .ownerEmail(l.getBusiness() != null && l.getBusiness().getOwner() != null
                    ? l.getBusiness().getOwner().getEmail() : null)
                .createdAt(l.getCreatedAt())
                .build())
            .toList();
    }

    @Transactional
    public AdminListingDto setListingStatus(Long listingId, com.hotelapp.enums.ListingStatus status) {
        var listing = jobListingRepository.findById(listingId)
            .orElseThrow(() -> new ResourceNotFoundException("İlan", listingId));
        listing.setStatus(status);
        jobListingRepository.save(listing);
        return AdminListingDto.builder()
            .id(listing.getId())
            .title(listing.getTitle())
            .position(listing.getPosition() != null ? listing.getPosition().name() : null)
            .status(listing.getStatus().name())
            .businessId(listing.getBusiness() != null ? listing.getBusiness().getId() : null)
            .businessName(listing.getBusiness() != null ? listing.getBusiness().getName() : null)
            .ownerEmail(listing.getBusiness() != null && listing.getBusiness().getOwner() != null
                ? listing.getBusiness().getOwner().getEmail() : null)
            .createdAt(listing.getCreatedAt())
            .build();
    }

    @Data @Builder
    public static class AdminListingDto {
        private Long id;
        private String title;
        private String position;
        private String status;
        private Long businessId;
        private String businessName;
        private String ownerEmail;
        private LocalDateTime createdAt;
    }

    // ================================================================
    // FAZ G.3 — Isletme dogrulama (KYC onay rozeti)
    // ================================================================

    @Data @Builder
    public static class AdminBusinessDto {
        private Long id;
        private String name;
        private String type;
        private String district;
        private String ownerEmail;
        private LocalDateTime verifiedAt;   // null = onaysiz
        private Long verifiedBy;
    }

    @Transactional(readOnly = true)
    public List<AdminBusinessDto> listBusinessesForAdmin(Boolean verifiedOnly, String search) {
        var stream = businessRepository.findAll().stream();
        if (Boolean.TRUE.equals(verifiedOnly)) {
            stream = stream.filter(b -> b.getVerifiedAt() != null);
        } else if (Boolean.FALSE.equals(verifiedOnly)) {
            stream = stream.filter(b -> b.getVerifiedAt() == null);
        }
        if (search != null && !search.isBlank()) {
            String q = search.trim().toLowerCase();
            stream = stream.filter(b ->
                (b.getName() != null && b.getName().toLowerCase().contains(q)) ||
                (b.getOwner() != null && b.getOwner().getEmail() != null
                    && b.getOwner().getEmail().toLowerCase().contains(q)));
        }
        return stream
            .limit(200)
            .map(this::toAdminBusinessDto)
            .toList();
    }

    /** Toggle: verified ise verifiedAt=null, degilse simdiki tarih + admin id. */
    @Transactional
    public AdminBusinessDto setBusinessVerified(Long businessId, boolean verified, Long adminId) {
        var biz = businessRepository.findById(businessId)
            .orElseThrow(() -> new ResourceNotFoundException("İşletme", businessId));
        if (verified) {
            biz.setVerifiedAt(LocalDateTime.now());
            biz.setVerifiedBy(adminId);
        } else {
            biz.setVerifiedAt(null);
            biz.setVerifiedBy(null);
        }
        businessRepository.save(biz);
        return toAdminBusinessDto(biz);
    }

    private AdminBusinessDto toAdminBusinessDto(com.hotelapp.entity.Business b) {
        return AdminBusinessDto.builder()
            .id(b.getId())
            .name(b.getName())
            .type(b.getType() != null ? b.getType().name() : null)
            .district(b.getDistrict())
            .ownerEmail(b.getOwner() != null ? b.getOwner().getEmail() : null)
            .verifiedAt(b.getVerifiedAt())
            .verifiedBy(b.getVerifiedBy())
            .build();
    }

    @Data
    public static class SetListingStatusRequest {
        @NotNull private com.hotelapp.enums.ListingStatus status;
    }
}
