package com.hotelapp.service;

import com.hotelapp.entity.ProfileView;
import com.hotelapp.repository.ProfileViewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Dalga H3 — Profil goruntulenme tracking
 * - record(profileId, viewerId): CandidatePublicPage hit, idempotent gunluk
 * - countLastDays(profileId, days): Son N gun sayim (toplam + unique)
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ProfileViewService {

    private final ProfileViewRepository profileViewRepository;

    /**
     * Yeni view kaydi. Ayni viewer ayni profile ayni gun 2. kez bakarsa
     * yeni kayit OLUSTURMAZ (gunluk dedupe).
     * Self-view (aday kendi profili) sayilmaz.
     *
     * REQUIRES_NEW: getPublicProfile() readOnly transaction icinde cagrilir;
     * INSERT icin temiz, ayri transaction gerek. Hata olursa ana akisi
     * bozmadan log + yutulur (audit silinse de profil acilmasi gerek).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long profileId, Long viewerId) {
        try {
            if (profileId == null) return;
            if (viewerId != null && viewerId.equals(profileId)) return;

            if (viewerId != null) {
                LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
                if (profileViewRepository.existsTodayByProfileAndViewer(profileId, viewerId, startOfDay)) {
                    return;
                }
            }

            profileViewRepository.save(ProfileView.builder()
                    .profileId(profileId)
                    .viewerId(viewerId)
                    .build());
        } catch (RuntimeException ex) {
            // Audit yazma hatasi profil acilmasini engellemesin
            log.warn("ProfileView audit yazilirken hata olustu — gormezden geliniyor. profile={} viewer={}",
                    profileId, viewerId, ex);
        }
    }

    @Transactional(readOnly = true)
    public ProfileViewStats getStats(Long profileId, int days) {
        LocalDateTime since = LocalDate.now().minusDays(days).atStartOfDay();
        long total = profileViewRepository.countByProfileIdSince(profileId, since);
        long unique = profileViewRepository.countDistinctViewersByProfileIdSince(profileId, since);
        return new ProfileViewStats(total, unique, days);
    }

    public record ProfileViewStats(long totalViews, long uniqueViewers, int days) {}
}
