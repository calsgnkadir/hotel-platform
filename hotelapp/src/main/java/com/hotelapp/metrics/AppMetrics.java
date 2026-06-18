package com.hotelapp.metrics;

import com.hotelapp.repository.OutboxEventRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

/**
 * FAZ D.4 — Custom Prometheus metrics.
 *
 * Domain-spesifik observability — generic JVM/HTTP metric'lerinin ustune
 * basvuru akisi, outbox saglik durumu ve idempotency cache effectiveness'i.
 *
 * Scrape: GET /actuator/prometheus
 */
@Component
public class AppMetrics {

    public final Counter outboxPublished;
    public final Counter outboxFailed;
    public final Counter applicationsCreated;
    public final Counter applicationsAccepted;
    public final Counter idempotencyHit;
    public final Counter idempotencyMiss;

    public AppMetrics(MeterRegistry registry, OutboxEventRepository outboxRepository) {
        this.outboxPublished = Counter.builder("app.outbox.events.published")
                .description("Outbox event'leri basariyla teslim edildi")
                .register(registry);
        this.outboxFailed = Counter.builder("app.outbox.events.failed")
                .description("Outbox event teslim girisimi fail oldu (retry edilecek)")
                .register(registry);
        this.applicationsCreated = Counter.builder("app.applications.created")
                .description("Yeni basvuru olusturuldu")
                .register(registry);
        this.applicationsAccepted = Counter.builder("app.applications.accepted")
                .description("Basvuru kabul edildi")
                .register(registry);
        this.idempotencyHit = Counter.builder("app.idempotency.cache.hit")
                .description("Idempotency-Key cache hit — chain bypass")
                .register(registry);
        this.idempotencyMiss = Counter.builder("app.idempotency.cache.miss")
                .description("Idempotency-Key cache miss — chain calisti")
                .register(registry);

        // Pending outbox gauge — her scrape'te DB count cekilir (cheap query)
        registry.gauge("app.outbox.pending",
                outboxRepository,
                repo -> (double) repo.countByProcessedAtIsNull());
    }
}
