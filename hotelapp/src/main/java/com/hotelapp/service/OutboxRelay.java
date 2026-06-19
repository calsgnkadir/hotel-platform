package com.hotelapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.entity.OutboxEvent;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.event.EmailMessage;
import com.hotelapp.metrics.AppMetrics;
import com.hotelapp.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

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
    /** Public: hem repository query'sinde hem de OutboxStatusWriter'da magic 5 tekrar etmesin. */
    public static final int MAX_ATTEMPTS = 5;

    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final AuditLogService auditLogService;
    private final EmailService emailService; // FAZ D.9
    private final OutboxStatusWriter statusWriter; // FAZ F.4 — self-invocation fix
    private final org.springframework.beans.factory.ObjectProvider<AppMetrics> metrics; // optional

    @Scheduled(fixedDelayString = "${app.outbox.relayDelayMs:5000}")
    public void relay() {
        List<OutboxEvent> pending = outboxRepository.findUnprocessed(
                MAX_ATTEMPTS, PageRequest.of(0, BATCH_SIZE));
        if (pending.isEmpty()) return;

        log.debug("[OUTBOX-RELAY] {} pending event islenecek", pending.size());
        AppMetrics m = metrics.getIfAvailable();
        for (OutboxEvent row : pending) {
            try {
                handle(row);
                statusWriter.markProcessed(row.getId());
                if (m != null) m.outboxPublished.increment();
            } catch (Exception ex) {
                statusWriter.markFailed(row.getId(), ex, MAX_ATTEMPTS);
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
            case OutboxService.TYPE_EMAIL -> {
                EmailMessage e = objectMapper.readValue(row.getPayload(), EmailMessage.class);
                emailService.send(e.to(), e.subject(), e.html());
            }
            default -> {
                log.warn("[OUTBOX-RELAY] bilinmeyen eventType={} id={}", row.getEventType(), row.getId());
                throw new IllegalArgumentException("unknown event type: " + row.getEventType());
            }
        }
    }

    // markProcessed / markFailed FAZ F.4 ile OutboxStatusWriter'a tasindi
    // (self-invocation + @Transactional proxy bypass fix'i).

    /**
     * FAZ F.6 — Eski teslim edilmis event'leri sil. Her gece 04:00.
     * Default 30 gun retention; observability icin "su olaydan sonra ne oldu"
     * sorularina cevap vermek icin yeterli, sonra DB sismesini engeller.
     */
    @Scheduled(cron = "${app.outbox.cleanupCron:0 0 4 * * *}")
    @org.springframework.transaction.annotation.Transactional
    public void cleanupProcessed() {
        var cutoff = java.time.LocalDateTime.now().minusDays(30);
        int deleted = outboxRepository.deleteProcessedOlderThan(cutoff);
        if (deleted > 0) {
            log.info("[OUTBOX-CLEANUP] {} eski islenmis event silindi (>30 gun)", deleted);
        }
    }
}
