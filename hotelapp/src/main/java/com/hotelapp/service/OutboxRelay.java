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
 * Her 5 sn zamani gelmis pending event'leri okur, eventType'a gore handler cagirir.
 * Basarili = processed_at NOW, basarisiz = attempts++ + last_error + next_attempt_at
 * (V26 ustel bekleme: 30sn, 1, 2, 4, 8, 16, 32 dk, 1 sa, 1 sa — MAX_ATTEMPTS=10 deneme
 * ~3 saate yayilir, sonra DLQ). Devre kesici acikken deneme sayilmaz, yalniz ertelenir.
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

    /** İş kuralı saati: Türkiye yerel saati, JVM saat diliminden bağımsız (testte sabitlenebilir). */
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

    private static final int BATCH_SIZE = 20;
    /** Public: hem repository query'sinde hem de OutboxStatusWriter'da magic 5 tekrar etmesin. */
    public static final int MAX_ATTEMPTS = 10;
    static final java.time.Duration BASE_BACKOFF = java.time.Duration.ofSeconds(30);
    static final java.time.Duration MAX_BACKOFF = java.time.Duration.ofHours(1);
    /** Devre acikken erteleme — resilience4j waitDurationInOpenState (30 sn) ile ayni. */
    static final java.time.Duration CIRCUIT_OPEN_DELAY = java.time.Duration.ofSeconds(30);

    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final AuditLogService auditLogService;
    private final EmailService emailService; // FAZ D.9
    private final OutboxStatusWriter statusWriter; // FAZ F.4 — self-invocation fix
    private final org.springframework.beans.factory.ObjectProvider<AppMetrics> metrics; // optional

    @Scheduled(fixedDelayString = "${app.outbox.relayDelayMs:5000}",
               initialDelayString = "${app.outbox.relayInitialDelayMs:0}")
    public void relay() {
        List<OutboxEvent> pending = outboxRepository.findDue(
                MAX_ATTEMPTS, java.time.LocalDateTime.now(clock), PageRequest.of(0, BATCH_SIZE));
        if (pending.isEmpty()) return;

        log.debug("[OUTBOX-RELAY] {} pending event islenecek", pending.size());
        AppMetrics m = metrics.getIfAvailable();
        for (OutboxEvent row : pending) {
            try {
                handle(row);
                statusWriter.markProcessed(row.getId());
                if (m != null) m.outboxPublished.increment();
            } catch (Exception ex) {
                if (isCircuitOpen(ex)) {
                    statusWriter.markDeferred(row.getId(), CIRCUIT_OPEN_DELAY, ex);
                } else {
                    statusWriter.markFailed(row.getId(), ex, MAX_ATTEMPTS);
                    if (m != null) m.outboxFailed.increment();
                }
            }
        }
    }

    /**
     * n. basarisiz denemeden sonra bekleme: 30 sn * 2^(n-1), ust sinir 1 saat.
     * n=1→30sn, 2→1dk, 3→2dk, 4→4dk, 5→8dk, 6→16dk, 7→32dk, 8+→1sa.
     */
    public static java.time.Duration backoffAfter(int failedAttempts) {
        int exp = Math.max(0, Math.min(failedAttempts - 1, 20));
        java.time.Duration d = BASE_BACKOFF.multipliedBy(1L << exp);
        return d.compareTo(MAX_BACKOFF) > 0 ? MAX_BACKOFF : d;
    }

    static boolean isCircuitOpen(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof io.github.resilience4j.circuitbreaker.CallNotPermittedException) return true;
            if (t.getCause() == t) break;
        }
        return false;
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
        var cutoff = java.time.LocalDateTime.now(clock).minusDays(30);
        int deleted = outboxRepository.deleteProcessedOlderThan(cutoff);
        if (deleted > 0) {
            log.info("[OUTBOX-CLEANUP] {} eski islenmis event silindi (>30 gun)", deleted);
        }
    }
}
