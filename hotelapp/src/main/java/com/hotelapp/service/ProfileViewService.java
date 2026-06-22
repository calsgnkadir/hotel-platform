package com.hotelapp.service;

import com.hotelapp.entity.ProfileView;
import com.hotelapp.repository.ProfileViewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Dalga H3 — Profil goruntulenme tracking
 * - record(profileId, viewerId): CandidatePublicPage hit, idempotent gunluk
 * - countLastDays(profileId, days): Son N gun sayim (toplam + unique)
 */
@Service
@RequiredArgsConstructor
public class ProfileViewService {

    private final ProfileViewRepository profileViewRepository;

    /**
     * Yeni view kaydi. Ayni viewer ayni profile ayni gun 2. kez bakarsa
     * yeni kayit OLUSTURMAZ (gunluk dedupe).
     * Self-view (aday kendi profili) sayilmaz.
     */
    @Transactional
    public void record(Long profileId, Long viewerId) {
        if (profileId == null) return;
        // Self-view sayma
        if (viewerId != null && viewerId.equals(profileId)) return;

        // Gunluk dedupe
        if (viewerId != null) {
            LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
            if (profileViewRepository.existsTodayByProfileAndViewer(profileId, viewerId, startOfDay)) {
                return;  // bugun zaten baktigi sayildi
            }
        }

        profileViewRepository.save(ProfileView.builder()
                .profileId(profileId)
                .viewerId(viewerId)
                .build());
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
