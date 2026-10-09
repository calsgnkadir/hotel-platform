package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.BusinessFavorite;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessFavoriteRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * FAZ 2/#32 — Talent pool servisi.
 * Isletme sahibinin ID'sinden Business'a, sonra favorite tablosuna ulasilir.
 */
@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final BusinessFavoriteRepository favoriteRepository;
    private final BusinessRepository businessRepository;
    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;

    /** Isletme sahibinin Business'ini bul (yoksa exception) */
    private Business getBusinessForOwner(Long ownerId) {
        return businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new BusinessRuleException(
                        "Once isletme profilini olustur (Settings > Isletme)"));
    }

    @Transactional
    public FavoriteDto addFavorite(Long ownerId, Long candidateId, String note) {
        Business business = getBusinessForOwner(ownerId);
        // Aday profili kurali ile ayni iliski: isletme yalnizca kendisine (herhangi
        // bir ilanina, herhangi statude) basvurmus adayi favoriye ekleyebilir.
        // Hedef yok / aday degil / iliski yok -> hepsi ayni 404 (varlik ifsa edilmez).
        User candidate = userRepository.findById(candidateId)
                .filter(u -> u.getRole() == Role.CANDIDATE)
                .filter(u -> applicationRepository
                        .existsByCandidateIdAndJobListingBusinessOwnerId(candidateId, ownerId))
                .orElseThrow(() -> new ResourceNotFoundException("Aday", candidateId));
        // Toggle: zaten varsa exception yerine return existing (idempotent)
        return favoriteRepository.findByBusinessIdAndCandidateId(business.getId(), candidateId)
                .map(f -> toDto(f, ownerId))
                .orElseGet(() -> {
                    BusinessFavorite fav = BusinessFavorite.builder()
                            .business(business)
                            .candidate(candidate)
                            .note(note)
                            .createdAt(LocalDateTime.now())
                            .build();
                    return toDto(favoriteRepository.save(fav), ownerId);
                });
    }

    @Transactional
    public void removeFavorite(Long ownerId, Long candidateId) {
        Business business = getBusinessForOwner(ownerId);
        favoriteRepository.findByBusinessIdAndCandidateId(business.getId(), candidateId)
                .ifPresent(favoriteRepository::delete);
    }

    @Transactional(readOnly = true)
    public List<FavoriteDto> listFavorites(Long ownerId) {
        Business business = getBusinessForOwner(ownerId);
        return favoriteRepository.findByBusinessIdOrderByCreatedAtDesc(business.getId())
                .stream().map(f -> toDto(f, ownerId)).toList();
    }

    @Transactional(readOnly = true)
    public boolean isFavorited(Long ownerId, Long candidateId) {
        Optional<Business> b = businessRepository.findByOwnerId(ownerId);
        return b.isPresent()
                && favoriteRepository.existsByBusinessIdAndCandidateId(b.get().getId(), candidateId);
    }

    /** Aday icin: kac isletme tarafindan favorilenmis (motivasyon) */
    @Transactional(readOnly = true)
    public long countFavoritedBy(Long candidateId) {
        return favoriteRepository.countByCandidateId(candidateId);
    }

    /**
     * E-posta hassas alandir: CandidateProfileService ile ayni politika — yalnizca
     * bu isletmeyle ACCEPTED basvurusu varsa doldurulur, aksi halde null. Iliskisi
     * kalmamis (basvurusu silinmis) eski favoriler listede e-postasiz gorunur.
     */
    private FavoriteDto toDto(BusinessFavorite f, Long ownerId) {
        User c = f.getCandidate();
        boolean canSeeSensitive = applicationRepository
                .existsByCandidateIdAndJobListingBusinessOwnerIdAndStatus(
                        c.getId(), ownerId, ApplicationStatus.ACCEPTED);
        return FavoriteDto.builder()
                .id(f.getId())
                .candidateId(c.getId())
                .candidateName(c.getFullName())
                .candidateEmail(canSeeSensitive ? c.getEmail() : null)
                .candidateAvatarUrl(c.getAvatarPath())  // raw, frontend buildUrl gerek
                .candidateDistrict(c.getDistrict())
                .note(f.getNote())
                .createdAt(f.getCreatedAt())
                .build();
    }

    @Data @Builder
    public static class FavoriteDto {
        private Long id;
        private Long candidateId;
        private String candidateName;
        private String candidateEmail;  // yalnizca ACCEPTED iliskide dolu, aksi null
        private String candidateAvatarUrl;
        private String candidateDistrict;
        private String note;
        private LocalDateTime createdAt;
    }
}
