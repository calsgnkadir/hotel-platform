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

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    /** Bir kullanıcının yaptığı eylemi kaydet (actor email/role otomatik çözülür).
     *  REQUIRES_NEW: ana akışı bozmaz, kendi tx'inde calisir. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(Long actorId, String action, String targetType, Long targetId, String details) {
        try {
            String email = "?";
            String role = "?";
            if (actorId != null) {
                User u = userRepository.findById(actorId).orElse(null);
                if (u != null) {
                    email = u.getEmail();
                    role = u.getRole().name();
                }
            }
            save(actorId, email, role, action, targetType, targetId, details);
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
                .createdAt(LocalDateTime.now())
                .build();
        auditLogRepository.save(entry);
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> list(String action, int limit) {
        var pageable = PageRequest.of(0, Math.min(limit, 200));
        Page<AuditLog> page = (action != null && !action.isBlank())
                ? auditLogRepository.findAllByActionOrderByCreatedAtDesc(action, pageable)
                : auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);
        return page.getContent().stream().map(this::toDto).toList();
    }

    private AuditLogDto toDto(AuditLog a) {
        return AuditLogDto.builder()
                .id(a.getId())
                .actorEmail(a.getActorEmail())
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
        private String actorEmail;
        private String actorRole;
        private String action;
        private String targetType;
        private Long targetId;
        private String details;
        private LocalDateTime createdAt;
    }
}
