package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.NotificationRepository;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * FAZ D.8 — KVKK haklari servisi.
 *
 * Iki ana islem:
 *  1) Data export: kullanici tum verisini JSON olarak indirir
 *  2) Hesap silme: soft delete + 30 gun grace + scheduler anonymize
 *
 * Yasal not: 30 gun grace, KVKK madde 11 (silme hakki) ile uyumlu — kullanici
 * herhangi bir an icinde recovery isteyebilir (admin destek kanali). Sonra
 * PII anonymize edilir; basvuru/yorum gibi referans olunan veriler "Silinmis
 * Kullanici" ismiyle korunur (referential integrity).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GdprService {

    /** Hesap silme istegi sonrasi PII anonymize edilene kadar bekleme suresi. */
    public static final int DELETION_GRACE_DAYS = 30;

    private static final String ANONYMIZED_EMAIL_TEMPLATE = "deleted-%d@deleted.local";
    private static final String ANONYMIZED_NAME           = "Silinmiş Kullanıcı";

    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final NotificationRepository notificationRepository;
    private final OutboxService outboxService;

    /**
     * Kullanicinin tum verisini map olarak doner. Controller bunu JSON
     * serialize edip Content-Disposition: attachment ile indirir.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> exportUserData(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", userId));

        Map<String, Object> export = new LinkedHashMap<>();
        export.put("exportedAt", LocalDateTime.now().toString());
        export.put("legalBasis", "KVKK Madde 11 - verilere erişim hakkı");

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("id", u.getId());
        profile.put("email", u.getEmail());
        profile.put("fullName", u.getFullName());
        profile.put("role", u.getRole() != null ? u.getRole().name() : null);
        profile.put("phone", u.getPhone());
        profile.put("district", u.getDistrict());
        profile.put("neighborhood", u.getNeighborhood());
        profile.put("birthDate", u.getBirthDate() != null ? u.getBirthDate().toString() : null);
        profile.put("gender", u.getGender() != null ? u.getGender().name() : null);
        profile.put("isStudent", u.isStudent());
        profile.put("enabled", u.isEnabled());
        profile.put("emailVerifiedAt", u.getEmailVerifiedAt() != null ? u.getEmailVerifiedAt().toString() : null);
        profile.put("authProvider", u.getProvider() != null ? u.getProvider().name() : null);
        export.put("profile", profile);

        // Basvuruları sade ozet (kapsamli ApplicationResponse kullanmiyoruz —
        // burada PII surrogate'larin azaltilmasi onemli)
        List<Map<String, Object>> apps = applicationRepository.findAllByCandidateId(userId).stream()
                .map(a -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", a.getId());
                    m.put("status", a.getStatus() != null ? a.getStatus().name() : null);
                    m.put("createdAt", a.getCreatedAt() != null ? a.getCreatedAt().toString() : null);
                    m.put("listingTitle", a.getJobListing() != null ? a.getJobListing().getTitle() : null);
                    m.put("businessName", a.getJobListing() != null && a.getJobListing().getBusiness() != null
                            ? a.getJobListing().getBusiness().getName() : null);
                    m.put("coverLetter", a.getCoverLetter());
                    m.put("noShow", a.isNoShow());
                    return m;
                })
                .toList();
        export.put("applications", apps);

        // Bildirimler
        List<Map<String, Object>> notifs = notificationRepository.findAllByRecipientIdOrderByCreatedAtDesc(
                        userId, org.springframework.data.domain.Pageable.unpaged()).getContent().stream()
                .map(n -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("type", n.getType() != null ? n.getType().name() : null);
                    m.put("title", n.getTitle());
                    m.put("body", n.getMessage());
                    m.put("read", Boolean.TRUE.equals(n.getIsRead()));
                    m.put("createdAt", n.getCreatedAt() != null ? n.getCreatedAt().toString() : null);
                    return m;
                })
                .toList();
        export.put("notifications", notifs);

        return export;
    }

    /**
     * Soft delete: enabled=false + deletionRequestedAt set +
     * scheduledAnonymizeAt = now + 30 gun.
     *
     * Idempotent: ayni kullanici 2 kez cagirirsa tarih GUNCELLENMEZ
     * (recovery suresi degismez).
     */
    @Transactional
    public void requestDeletion(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", userId));

        if (u.getDeletionRequestedAt() != null) {
            // Idempotent — zaten istek var
            log.info("[GDPR] userId={} icin zaten silme istegi var (req={})", userId, u.getDeletionRequestedAt());
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        u.setEnabled(false);
        u.setDeletionRequestedAt(now);
        u.setScheduledAnonymizeAt(now.plusDays(DELETION_GRACE_DAYS));
        userRepository.save(u);

        log.info("[GDPR] userId={} hesap silme istegi: anonymize date={}", userId, u.getScheduledAnonymizeAt());

        // Audit log via outbox
        outboxService.appendAuditLog(AuditLoggedEvent.user(
                userId, "DELETION_REQUESTED", "USER", userId,
                "Kullanıcı hesap silme talebi. Anonymize: " + u.getScheduledAnonymizeAt()));
    }

    /**
     * Kullanici tekrar login yapabilmek isterse (grace period icinde),
     * admin destek hattindan recovery. Bu metod controller endpoint'i
     * uzerinden admin tarafindan cagrilabilir veya kullanici aktive eder
     * (eger henuz enabled=true degilse).
     *
     * Simdilik kapsam disi — manual SQL gerekirse:
     *   UPDATE users SET enabled=1, deletion_requested_at=NULL,
     *                    scheduled_anonymize_at=NULL WHERE id=?
     */

    /**
     * Her gece 03:00'te calisan scheduler — anonymize cutoff'u gecmis
     * kullanicilarin PII alanlarini maskeler.
     *
     * Cron: 0 0 3 * * * (saniye dakika saat gunay haftaicigunu)
     */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void anonymizeDueAccounts() {
        LocalDateTime now = LocalDateTime.now();
        List<User> due = userRepository.findAllByScheduledAnonymizeAtBefore(now);
        if (due.isEmpty()) return;

        log.info("[GDPR-ANONYMIZE] {} kullanici anonymize edilecek", due.size());
        for (User u : due) {
            anonymize(u);
        }
    }

    private void anonymize(User u) {
        Long id = u.getId();
        String originalEmail = u.getEmail();
        u.setEmail(String.format(ANONYMIZED_EMAIL_TEMPLATE, id));
        u.setFullName(ANONYMIZED_NAME);
        u.setPhone(null);
        u.setAvatarPath(null);
        u.setDistrict(null);
        u.setNeighborhood(null);
        u.setBirthDate(null);
        u.setGender(null);
        u.setScheduledAnonymizeAt(null);
        userRepository.save(u);

        log.info("[GDPR-ANONYMIZE] userId={} anonymize edildi (eski email maskelendi)", id);

        outboxService.appendAuditLog(AuditLoggedEvent.system(
                "USER_ANONYMIZED", "USER", id,
                "Hesap 30 gun grace sonrasi anonymize edildi (KVKK)."));
    }
}
