package com.hotelapp.service;

import com.hotelapp.entity.AuditLog;
import com.hotelapp.entity.User;
import com.hotelapp.repository.AuditLogRepository;
import com.hotelapp.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * D4: Denetim kaydı servisi.
 * log(...) eylemleri kaydeder; loglama hatası ASLA ana işlemi bozmamalı (try-catch).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    /** İş kuralı saati: Türkiye yerel saati, JVM saat diliminden bağımsız (testte sabitlenebilir). */
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    /** Kayitta aktor e-postasi yerine yazilan takma ad oneki (KVKK: audit kaydinda duz e-posta yok). */
    static final String ACTOR_REF_PREFIX = "user:";

    /** Bir kullanıcının yaptığı eylemi kaydet (actor rolü otomatik çözülür).
     *  KVKK: actor_email kolonuna e-posta değil "user:{id}" yazılır; admin listesinde
     *  e-posta okuma anında güncel kullanıcı kaydından çözülür (anonimleştirilen hesap
     *  geçmiş kayıtlarda da anonim görünür).
     *  REQUIRES_NEW: ana akışı bozmaz, kendi tx'inde calisir. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(Long actorId, String action, String targetType, Long targetId, String details) {
        try {
            String actorRef = actorId != null ? ACTOR_REF_PREFIX + actorId : "?";
            String role = "?";
            if (actorId != null) {
                User u = userRepository.findById(actorId).orElse(null);
                if (u != null && u.getRole() != null) {
                    role = u.getRole().name();
                }
            }
            save(actorId, actorRef, role, action, targetType, targetId, details);
        } catch (Exception e) {
            // Audit log hatası ana akışı bozmaz, sadece uyarı
            log.warn("Audit log yazılamadı: action={} - {}", action, e.getMessage());
        }
    }

    /** Sistem tarafından otomatik tetiklenen eylem (örn. otomatik ban).
     *  REQUIRES_NEW: ana akışı bozmaz. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logSystem(String action, String targetType, Long targetId, String details) {
        try {
            save(null, "SYSTEM", "SYSTEM", action, targetType, targetId, details);
        } catch (Exception e) {
            log.warn("System audit log yazılamadı: action={} - {}", action, e.getMessage());
        }
    }

    private void save(Long actorId, String email, String role,
                      String action, String targetType, Long targetId, String details) {
        AuditLog entry = AuditLog.builder()
                .actorId(actorId)
                .actorEmail(email)
                .actorRole(role)
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .details(details)
                .createdAt(LocalDateTime.now(clock))
                .build();
        auditLogRepository.save(entry);
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> list(String action, int limit) {
        var pageable = PageRequest.of(0, Math.min(limit, 200));
        Page<AuditLog> page = (action != null && !action.isBlank())
                ? auditLogRepository.findAllByActionOrderByCreatedAtDesc(action, pageable)
                : auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);
        List<AuditLog> rows = page.getContent();
        // Aktor e-postasi kayitta tutulmaz; admin ekrani icin tek sorguda guncel kayittan cozulur.
        java.util.Set<Long> actorIds = rows.stream()
                .filter(a -> a.getActorId() != null
                        && a.getActorEmail() != null && a.getActorEmail().startsWith(ACTOR_REF_PREFIX))
                .map(AuditLog::getActorId)
                .collect(java.util.stream.Collectors.toSet());
        java.util.Map<Long, String> emails = actorIds.isEmpty() ? java.util.Map.of()
                : userRepository.findAllById(actorIds).stream()
                    .filter(u -> u.getEmail() != null)
                    .collect(java.util.stream.Collectors.toMap(User::getId, User::getEmail, (x, y) -> x));
        return rows.stream().map(a -> toDto(a, emails)).toList();
    }

    private AuditLogDto toDto(AuditLog a, java.util.Map<Long, String> emails) {
        String actor = a.getActorEmail();
        if (actor != null && actor.startsWith(ACTOR_REF_PREFIX) && a.getActorId() != null) {
            actor = emails.getOrDefault(a.getActorId(), actor);
        }
        return AuditLogDto.builder()
                .id(a.getId())
                .actorId(a.getActorId())
                .actorEmail(actor)
                .actorRole(a.getActorRole())
                .action(a.getAction())
                .targetType(a.getTargetType())
                .targetId(a.getTargetId())
                .details(a.getDetails())
                .createdAt(a.getCreatedAt())
                .build();
    }

    @Data @Builder
    public static class AuditLogDto {
        private Long id;
        private Long actorId;
        private String actorEmail;
        private String actorRole;
        private String action;
        private String targetType;
        private Long targetId;
        private String details;
        private LocalDateTime createdAt;
    }
}
