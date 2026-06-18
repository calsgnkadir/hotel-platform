package com.hotelapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.entity.OutboxEvent;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.metrics.AppMetrics;
import com.hotelapp.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * FAZ C.2 — Outbox relay scheduler.
 *
 * Her 5 sn pending event'leri okur, eventType'a gore handler cagirir.
 * Basarili = processed_at NOW, basarisiz = attempts++ + last_error.
 *
 * BATCH_SIZE: tek tick'te isleyecek max event sayisi. Backlog buyurse
 * sonraki tick'ler kaldigi yerden devam eder.
 *
 * Handler idempotency: AuditLogService.log() ayri INSERT yapar, duplicate
 * row icin business kontrolu yok — eger relay row'u isleyip processed
 * isaretlemeden once crash olursa, sonraki tick ayni row'u yine isler
 * (at-least-once). Audit log'da duplicate kabul edilebilir (gozlem amacli).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OutboxRelay {

    private static final int BATCH_SIZE = 20;
    private static final int MAX_ATTEMPTS = 5;

    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final AuditLogService auditLogService;
    private final org.springframework.beans.factory.ObjectProvider<AppMetrics> metrics; // optional

    @Scheduled(fixedDelayString = "${app.outbox.relayDelayMs:5000}")
    public void relay() {
        List<OutboxEvent> pending = outboxRepository.findUnprocessed(PageRequest.of(0, BATCH_SIZE));
        if (pending.isEmpty()) return;

        log.debug("[OUTBOX-RELAY] {} pending event islenecek", pending.size());
        AppMetrics m = metrics.getIfAvailable();
        for (OutboxEvent row : pending) {
            try {
                handle(row);
                markProcessed(row.getId());
                if (m != null) m.outboxPublished.increment();
            } catch (Exception ex) {
                markFailed(row.getId(), ex);
                if (m != null) m.outboxFailed.increment();
            }
        }
    }

    private void handle(OutboxEvent row) throws Exception {
        switch (row.getEventType()) {
            case OutboxService.TYPE_AUDIT_LOG -> {
                AuditLoggedEvent e = objectMapper.readValue(row.getPayload(), AuditLoggedEvent.class);
                if (e.isSystem()) {
                    auditLogService.logSystem(e.action(), e.targetType(), e.targetId(), e.details());
                } else {
                    auditLogService.log(e.actorId(), e.action(), e.targetType(), e.targetId(), e.details());
                }
            }
            default -> {
                log.warn("[OUTBOX-RELAY] bilinmeyen eventType={} id={}", row.getEventType(), row.getId());
                throw new IllegalArgumentException("unknown event type: " + row.getEventType());
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markProcessed(Long id) {
        outboxRepository.findById(id).ifPresent(e -> {
            e.setProcessedAt(LocalDateTime.now());
            outboxRepository.save(e);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long id, Exception ex) {
        outboxRepository.findById(id).ifPresent(e -> {
            e.setAttempts(e.getAttempts() + 1);
            String msg = ex.getClass().getSimpleName() + ": " + ex.getMessage();
            e.setLastError(msg.length() > 500 ? msg.substring(0, 500) : msg);
            outboxRepository.save(e);
            if (e.getAttempts() >= MAX_ATTEMPTS) {
                log.error("[OUTBOX-RELAY] event id={} max attempt ({}) asti, son hata: {}",
                        id, MAX_ATTEMPTS, msg);
            } else {
                log.warn("[OUTBOX-RELAY] event id={} fail (attempt {}): {}", id, e.getAttempts(), msg);
            }
        });
    }
}
