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
import com.hotelapp.repository.BusinessBlockRepository;
import com.hotelapp.repository.CandidateBlockRepository;
import com.hotelapp.repository.SavedSearchRepository;
import com.hotelapp.repository.UserRepository;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
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

    /** İş kuralı saati: Türkiye yerel saati, JVM saat diliminden bağımsız (testte sabitlenebilir). */
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

    public static final int MAX_PER_USER = 20;

    /**
     * Commit payı: ilanın yayın anı (publishedAt / createdAt) transaction içinde atanır, satır commit
     * olunca görünür. Tarama penceresinin üst sınırı şimdiden bu kadar geride tutulur
     * ki yavaş commit edilen ilan imlecin gerisinde kalıp kaçmasın. Tarama 30 dakikada
     * bir koştuğundan bildirim gecikmesine etkisi küçüktür.
     */
    static final java.time.Duration COMMIT_GRACE = java.time.Duration.ofMinutes(5);

    private final SavedSearchRepository repo;
    private final UserRepository userRepository;
    private final JobListingQueryService listingQueryService;
    private final NotificationService notificationService;
    private final BusinessBlockRepository businessBlockRepository;    // aday -> isletme engeli
    private final CandidateBlockRepository candidateBlockRepository;  // isletme -> aday engeli

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
                .lastNotifiedAt(LocalDateTime.now(clock))  // sıfır geçmiş için backfill atma
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
        // Devre disi (silme talebi) hesaba bildirim gitmez
        User owner = s.getUser();
        if (owner == null || !owner.isEnabled()) return 0;
        // Su an banli hesap giris yapamaz; kayitli arama bildirimi de gitmez (ban bitince surer)
        if (owner.getBannedUntil() != null && owner.getBannedUntil().isAfter(LocalDateTime.now(clock))) return 0;

        // Tarama penceresi (since, until]. lastNotifiedAt bir imleçtir: "bu ana kadar
        // yayına alınan ilanlar değerlendirildi". Yayın anı COALESCE(publishedAt, createdAt):
        // durdurulup yeniden yayına alınan ilan da (publishedAt ilerler) pencereye girer.
        // until = taramanın başlangıcı eksi commit payı: yayın anı transaction içinde
        // atanır, commit daha sonra gelir; pay içinde kalan ilan bir sonrakine bırakılır.
        // Pencereler yarı açık ve ardışık olduğundan aynı yayın iki kez bildirilmez.
        LocalDateTime since = s.getLastNotifiedAt() != null
                ? s.getLastNotifiedAt()
                : s.getCreatedAt();
        LocalDateTime until = LocalDateTime.now(clock).minus(COMMIT_GRACE);
        if (since != null && !until.isAfter(since)) return 0;   // pencere henüz boş

        List<Shift> shifts = s.getShifts() == null || s.getShifts().isEmpty()
                ? null
                : List.copyOf(s.getShifts());

        List<JobListing> matches = listingQueryService.findActivePublishedBetween(
                since, until,
                s.getPosition(), s.getJobType(), shifts,
                s.getDistrict(), s.getMinSalary(), s.getKeyword(),
                s.getDateFrom(), s.getDateTo()
        );

        // Engel kurali iki yonlu: adayin engelledigi ya da adayi engelleyen isletmenin
        // ilanlari bildirime girmez.
        Set<Long> excludedBusinessIds = new HashSet<>(
                businessBlockRepository.findBusinessIdsByUserId(owner.getId()));
        excludedBusinessIds.addAll(candidateBlockRepository.findBusinessIdsByCandidateId(owner.getId()));
        if (!excludedBusinessIds.isEmpty()) {
            matches = matches.stream()
                    .filter(l -> l.getBusiness() == null
                            || !excludedBusinessIds.contains(l.getBusiness().getId()))
                    .toList();
        }

        if (matches.isEmpty()) {
            // İmleç ilerletilmez: pencerede bildirilen ilan yok; tarama anında durdurulmuş
            // olup 24 saat içinde (publishedAt ilerlemeden) yeniden açılan ilan eşleşme
            // çıkana kadar sonraki taramalarda görünür kalır.
            return 0;
        }

        // Toplu bildirim: tek mesaj, en yeni eşleşmeye link (sorgu yayın anına göre DESC döner)
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

        // İmleç sorgulanan pencerenin sonuna ilerler (tarama bitiş anına değil): tarama
        // sırasında ya da commit payı içinde oluşan ilan sonraki pencerede kalır.
        s.setLastNotifiedAt(until);  // managed entity → dirty checking flush eder
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

    /**
     * Sınırlar saved_searches kolonlarıyla aynı (name 100, district 64, keyword 255,
     * min_salary DECIMAL(12,2)); aşan istek DB'ye inip 500 vermek yerine 400 döner.
     */
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CreatePayload {
        @NotBlank(message = "Arama adı zorunlu.")
        @Size(max = 100, message = "Arama adı en fazla 100 karakter olabilir.")
        private String name;
        private Position position;
        private JobType jobType;
        @Size(max = 64, message = "İlçe en fazla 64 karakter olabilir.")
        private String district;
        @Size(max = 255, message = "Anahtar kelime en fazla 255 karakter olabilir.")
        private String keyword;
        @DecimalMin(value = "0", message = "En az ücret negatif olamaz.")
        @Digits(integer = 10, fraction = 2, message = "En az ücret en fazla 10 basamak ve 2 ondalık olabilir.")
        private BigDecimal minSalary;
        private LocalDate dateFrom;
        private LocalDate dateTo;
        private Set<Shift> shifts;
    }

    @Data
    public static class UpdatePayload {
        @Size(max = 100, message = "Arama adı en fazla 100 karakter olabilir.")
        private String name;
        private Boolean notificationsEnabled;
    }
}
