package com.hotelapp.service;

import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.SavedSearch;
import com.hotelapp.entity.User;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Shift;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.SavedSearchRepository;
import com.hotelapp.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * FAZ 5 — Kayıtlı arama servisi.
 *
 * Sorumluluklar:
 *  - CRUD (create/list/update/delete) — sahip kontrolü
 *  - Tek bir saved search için yeni eşleşmeleri çekip notification atma (scheduler çağırır)
 *
 * Maks 20 kayıt/kullanıcı — uyarı: scheduler tarafından ağır taranır,
 * sınırsız bırakmak DB IO patlatır.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SavedSearchService {

    public static final int MAX_PER_USER = 20;

    private final SavedSearchRepository repo;
    private final UserRepository userRepository;
    private final JobListingQueryService listingQueryService;
    private final NotificationService notificationService;

    @Transactional
    public SavedSearch create(Long userId, CreatePayload p) {
        long existing = repo.countByUser_Id(userId);
        if (existing >= MAX_PER_USER) {
            throw new BusinessRuleException(
                    "En fazla " + MAX_PER_USER + " kayıtlı arama tutabilirsiniz. " +
                            "Önce eski bir aramayı silin.");
        }
        if (p.getName() == null || p.getName().isBlank()) {
            throw new BusinessRuleException("Arama adı zorunlu.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        SavedSearch s = SavedSearch.builder()
                .user(user)
                .name(p.getName().trim())
                .position(p.getPosition())
                .jobType(p.getJobType())
                .district(blankToNull(p.getDistrict()))
                .keyword(blankToNull(p.getKeyword()))
                .minSalary(p.getMinSalary())
                .dateFrom(p.getDateFrom())
                .dateTo(p.getDateTo())
                .shifts(p.getShifts() == null ? new HashSet<>() : new HashSet<>(p.getShifts()))
                .notificationsEnabled(true)
                .lastNotifiedAt(LocalDateTime.now())  // sıfır geçmiş için backfill atma
                .build();
        return repo.save(s);
    }

    @Transactional(readOnly = true)
    public List<SavedSearch> listMine(Long userId) {
        return repo.findByUser_IdOrderByCreatedAtDesc(userId);
    }

    @Transactional
    public SavedSearch update(Long userId, Long id, UpdatePayload p) {
        SavedSearch s = ownedById(userId, id);
        if (p.getName() != null && !p.getName().isBlank()) {
            s.setName(p.getName().trim());
        }
        if (p.getNotificationsEnabled() != null) {
            s.setNotificationsEnabled(p.getNotificationsEnabled());
        }
        return s;  // managed entity, dirty checking
    }

    @Transactional
    public void delete(Long userId, Long id) {
        SavedSearch s = ownedById(userId, id);
        repo.delete(s);
    }

    /**
     * Scheduler'dan çağrılır. Yeni eşleşme varsa notification atar,
     * lastNotifiedAt'ı günceller. İstisna olursa logla — diğer aramalar etkilenmesin.
     * ID alır ki entity tx içinde yeniden yüklensin (dirty checking için managed olmalı).
     */
    @Transactional
    public int notifyNewMatches(Long savedSearchId) {
        SavedSearch s = repo.findById(savedSearchId).orElse(null);
        if (s == null || !s.isNotificationsEnabled()) return 0;

        LocalDateTime since = s.getLastNotifiedAt() != null
                ? s.getLastNotifiedAt()
                : s.getCreatedAt();

        List<Shift> shifts = s.getShifts() == null || s.getShifts().isEmpty()
                ? null
                : List.copyOf(s.getShifts());

        List<JobListing> matches = listingQueryService.findActiveSince(
                since,
                s.getPosition(), s.getJobType(), shifts,
                s.getDistrict(), s.getMinSalary(), s.getKeyword(),
                s.getDateFrom(), s.getDateTo()
        );

        if (matches.isEmpty()) {
            // Yine de lastNotifiedAt'ı ilerletmiyoruz; backfill alanı eşleşme çıkana kadar açık kalsın
            return 0;
        }

        // Toplu bildirim: tek mesaj, ilk eşleşmeye link
        JobListing first = matches.get(0);
        String title = "\"" + s.getName() + "\" için yeni ilan";
        String message = matches.size() == 1
                ? first.getTitle()
                : first.getTitle() + " ve " + (matches.size() - 1) + " yeni ilan daha";
        String link = "/listings/" + first.getId();

        notificationService.notify(
                s.getUser().getId(),
                NotificationType.MATCHING_LISTING,
                title, message, link
        );

        s.setLastNotifiedAt(LocalDateTime.now());  // managed entity → dirty checking flush eder
        return matches.size();
    }

    /* ── helpers ── */

    private SavedSearch ownedById(Long userId, Long id) {
        SavedSearch s = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SavedSearch", id));
        if (!s.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("SavedSearch", id);
        }
        return s;
    }

    private static String blankToNull(String v) {
        return (v == null || v.isBlank()) ? null : v.trim();
    }

    /* ── DTOs ── */

    @Data @Builder
    public static class CreatePayload {
        private String name;
        private Position position;
        private JobType jobType;
        private String district;
        private String keyword;
        private BigDecimal minSalary;
        private LocalDate dateFrom;
        private LocalDate dateTo;
        private Set<Shift> shifts;
    }

    @Data
    public static class UpdatePayload {
        private String name;
        private Boolean notificationsEnabled;
    }
}
