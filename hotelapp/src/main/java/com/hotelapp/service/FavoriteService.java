package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.BusinessFavorite;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
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

    /** Isletme sahibinin Business'ini bul (yoksa exception) */
    private Business getBusinessForOwner(Long ownerId) {
        return businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new BusinessRuleException(
                        "Once isletme profilini olustur (Settings > Isletme)"));
    }

    @Transactional
    public FavoriteDto addFavorite(Long ownerId, Long candidateId, String note) {
        Business business = getBusinessForOwner(ownerId);
        User candidate = userRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Aday", candidateId));
        if (candidate.getRole() != Role.CANDIDATE) {
            throw new BusinessRuleException("Sadece aday hesaplari favori yapilabilir");
        }
        // Toggle: zaten varsa exception yerine return existing (idempotent)
        return favoriteRepository.findByBusinessIdAndCandidateId(business.getId(), candidateId)
                .map(this::toDto)
                .orElseGet(() -> {
                    BusinessFavorite fav = BusinessFavorite.builder()
                            .business(business)
                            .candidate(candidate)
                            .note(note)
                            .createdAt(LocalDateTime.now())
                            .build();
                    return toDto(favoriteRepository.save(fav));
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
                .stream().map(this::toDto).toList();
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

    private FavoriteDto toDto(BusinessFavorite f) {
        User c = f.getCandidate();
        return FavoriteDto.builder()
                .id(f.getId())
                .candidateId(c.getId())
                .candidateName(c.getFullName())
                .candidateEmail(c.getEmail())
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
        private String candidateEmail;
        private String candidateAvatarUrl;
        private String candidateDistrict;
        private String note;
        private LocalDateTime createdAt;
    }
}
