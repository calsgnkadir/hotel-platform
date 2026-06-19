package com.hotelapp.service;

import com.hotelapp.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * FAZ F.4 — Outbox processed/failed mark'larini ayri bean'e tasidik.
 *
 * Onceki halde: OutboxRelay.relay() icinde this.markProcessed()/markFailed()
 * direkt cagriliyordu. Self-invocation Spring AOP proxy'yi BYPASS eder,
 * @Transactional(REQUIRES_NEW) etkisiz kalir → status guncellemeleri commit
 * olmayabilir, sonuc: sonsuz retry veya kayip processed isareti.
 *
 * Cozum: ayri @Service bean'i, OutboxRelay buna delege eder. Spring proxy
 * dogru sekilde devreye girer.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OutboxStatusWriter {

    private final OutboxEventRepository outboxRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markProcessed(Long id) {
        outboxRepository.findById(id).ifPresent(e -> {
            e.setProcessedAt(LocalDateTime.now());
            outboxRepository.save(e);
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long id, Exception ex, int maxAttempts) {
        outboxRepository.findById(id).ifPresent(e -> {
            e.setAttempts(e.getAttempts() + 1);
            String msg = ex.getClass().getSimpleName() + ": " + ex.getMessage();
            e.setLastError(msg.length() > 500 ? msg.substring(0, 500) : msg);
            outboxRepository.save(e);
            if (e.getAttempts() >= maxAttempts) {
                log.error("[OUTBOX-RELAY] event id={} max attempt ({}) asti, son hata: {}",
                        id, maxAttempts, msg);
            } else {
                log.warn("[OUTBOX-RELAY] event id={} fail (attempt {}): {}", id, e.getAttempts(), msg);
            }
        });
    }
}
