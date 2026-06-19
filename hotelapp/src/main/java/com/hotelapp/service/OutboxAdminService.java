package com.hotelapp.service;

import com.hotelapp.entity.OutboxEvent;
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
 *  - "dead"     : attempts >= 5 ve hala teslim edilmemis (DLQ)
 *
 * Retry: attempts=0, lastError=null. Sonraki relay tick'inde tekrar islenir.
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
            case "dead"    -> outboxRepository.findDeadLetters(pageable);
            default        -> outboxRepository.findAllByOrderByCreatedAtDesc(pageable);
        };
        return page.getContent().stream().map(this::toDto).toList();
    }

    /** Manuel retry: attempts/error sifirlanir, processedAt NULL kalir. */
    @Transactional
    public void retry(Long id) {
        OutboxEvent e = outboxRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("OutboxEvent", id));
        e.setAttempts(0);
        e.setLastError(null);
        e.setProcessedAt(null);
        outboxRepository.save(e);
        log.info("[OUTBOX-ADMIN] event id={} manuel retry'a alindi (type={})", id, e.getEventType());
    }

    private OutboxEventDto toDto(OutboxEvent e) {
        String status;
        if (e.getProcessedAt() != null) status = "DELIVERED";
        else if (e.getAttempts() >= 5) status = "DEAD";
        else status = "PENDING";

        return OutboxEventDto.builder()
                .id(e.getId())
                .eventType(e.getEventType())
                .createdAt(e.getCreatedAt())
                .processedAt(e.getProcessedAt())
                .attempts(e.getAttempts())
                .lastError(e.getLastError())
                .status(status)
                .payloadPreview(preview(e.getPayload()))
                .build();
    }

    private String preview(String payload) {
        if (payload == null) return null;
        return payload.length() > 200 ? payload.substring(0, 200) + "…" : payload;
    }

    @Data @Builder
    public static class OutboxEventDto {
        private Long id;
        private String eventType;
        private LocalDateTime createdAt;
        private LocalDateTime processedAt;
        private Integer attempts;
        private String lastError;
        private String status; // DELIVERED / PENDING / DEAD
        private String payloadPreview;
    }
}
