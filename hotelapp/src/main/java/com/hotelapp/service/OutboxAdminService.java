package com.hotelapp.service;

import com.hotelapp.entity.OutboxEvent;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.OutboxEventRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * FAZ D.5 — Admin tarafindan outbox DLQ goruntuleme + manuel retry.
 *
 * Filter:
 *  - "all"      : tum event'ler (delivered dahil)
 *  - "pending"  : processedAt NULL (sirada veya retry)
 *  - "dead"     : attempts >= OutboxRelay.MAX_ATTEMPTS ve hala teslim edilmemis (DLQ)
 *
 * Retry: attempts=0, lastError=null, nextAttemptAt=null. Sonraki relay tick'inde tekrar islenir.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OutboxAdminService {

    private static final int MAX_LIMIT = 200;

    private final OutboxEventRepository outboxRepository;

    @Transactional(readOnly = true)
    public List<OutboxEventDto> list(String filter, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
        var pageable = PageRequest.of(0, safeLimit);
        var page = switch (filter == null ? "all" : filter.toLowerCase()) {
            case "pending" -> outboxRepository.findAllByProcessedAtIsNullOrderByCreatedAtDesc(pageable);
            case "dead"    -> outboxRepository.findDeadLetters(OutboxRelay.MAX_ATTEMPTS, pageable);
            default        -> outboxRepository.findAllByOrderByCreatedAtDesc(pageable);
        };
        return page.getContent().stream().map(this::toDto).toList();
    }

    /**
     * Manuel retry: attempts/error sifirlanir, processedAt NULL kalir.
     * FAZ F.4: DELIVERED guard — zaten teslim edilmis event'i tekrar islemek
     * duplicate email/audit yaratir. UI butonu sadece non-DELIVERED gosterse de
     * backend de korumali olmali (admin API direkt cagriya kapali degil).
     */
    @Transactional
    public void retry(Long id) {
        OutboxEvent e = outboxRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("OutboxEvent", id));
        if (e.getProcessedAt() != null) {
            throw new BusinessRuleException(
                    "Teslim edilmiş olay yeniden denenemez (çift teslimat riski).");
        }
        e.setAttempts(0);
        e.setLastError(null);
        e.setNextAttemptAt(null);   // V26 — ustel bekleme beklenmeden hemen denensin
        outboxRepository.save(e);
        log.info("[OUTBOX-ADMIN] event id={} manuel retry'a alindi (type={})", id, e.getEventType());
    }

    private OutboxEventDto toDto(OutboxEvent e) {
        String status;
        if (e.getProcessedAt() != null) status = "DELIVERED";
        else if (e.getAttempts() >= OutboxRelay.MAX_ATTEMPTS) status = "DEAD";
        else status = "PENDING";

        return OutboxEventDto.builder()
                .id(e.getId())
                .eventType(e.getEventType())
                .createdAt(e.getCreatedAt())
                .processedAt(e.getProcessedAt())
                .attempts(e.getAttempts())
                .lastError(com.hotelapp.security.PiiMasking.scrub(e.getLastError()))
                .nextAttemptAt(e.getNextAttemptAt())
                .status(status)
                .payloadPreview(preview(e))
                .build();
    }

    /**
     * KVKK: admin onizlemesi ham payload'i gostermez.
     *  - EMAIL: yalniz maskeli alici + konu; html govdesi (sifirlama/dogrulama
     *    baglantisi icerebilir) HIC gosterilmez.
     *  - Diger turler: e-posta/telefon desenleri maskelenir, sonra 200 karaktere kesilir
     *    (maskeleme kesmeden once — yarim kalan adres sizmasin).
     */
    static String preview(OutboxEvent e) {
        String payload = e.getPayload();
        if (payload == null) return null;
        if (OutboxService.TYPE_EMAIL.equals(e.getEventType())) {
            return emailPreview(payload);
        }
        String masked = com.hotelapp.security.PiiMasking.scrub(payload);
        return masked.length() > PREVIEW_LIMIT ? masked.substring(0, PREVIEW_LIMIT) + "…" : masked;
    }

    private static final int PREVIEW_LIMIT = 200;
    private static final com.fasterxml.jackson.databind.ObjectMapper JSON =
            new com.fasterxml.jackson.databind.ObjectMapper();

    private static String emailPreview(String payload) {
        try {
            var node = JSON.readTree(payload);
            var out = JSON.createObjectNode();
            out.put("to", com.hotelapp.security.PiiMasking.email(text(node, "to")));
            String subject = com.hotelapp.security.PiiMasking.scrub(text(node, "subject"));
            if (subject != null && subject.length() > PREVIEW_LIMIT) {
                subject = subject.substring(0, PREVIEW_LIMIT) + "…";
            }
            out.put("subject", subject);
            return JSON.writeValueAsString(out);
        } catch (Exception ex) {
            return "[e-posta içeriği gizlendi]";
        }
    }

    private static String text(com.fasterxml.jackson.databind.JsonNode node, String field) {
        var v = node == null ? null : node.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    @Data @Builder
    public static class OutboxEventDto {
        private Long id;
        private String eventType;
        private LocalDateTime createdAt;
        private LocalDateTime processedAt;
        private Integer attempts;
        private String lastError;
        /** V26 — PENDING ise bir sonraki deneme zamani (null = hemen). */
        private LocalDateTime nextAttemptAt;
        private String status; // DELIVERED / PENDING / DEAD
        private String payloadPreview;
    }
}
