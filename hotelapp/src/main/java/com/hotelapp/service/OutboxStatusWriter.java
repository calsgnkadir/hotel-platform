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

    /**
     * Basarisiz deneme: attempts++, son hata, V26 ustel bekleme ile nextAttemptAt ileri.
     * attempts maxAttempts'e ulasirsa DLQ (relay artik almaz; admin "yeniden dene" ile doner).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(Long id, Exception ex, int maxAttempts) {
        outboxRepository.findById(id).ifPresent(e -> {
            e.setAttempts(e.getAttempts() + 1);
            String msg = errorText(ex);
            e.setLastError(msg);
            if (e.getAttempts() >= maxAttempts) {
                e.setNextAttemptAt(null);
                outboxRepository.save(e);
                log.error("[OUTBOX-RELAY] event id={} max attempt ({}) asti, DLQ. Son hata: {}",
                        id, maxAttempts, msg);
            } else {
                var delay = OutboxRelay.backoffAfter(e.getAttempts());
                e.setNextAttemptAt(LocalDateTime.now().plus(delay));
                outboxRepository.save(e);
                log.warn("[OUTBOX-RELAY] event id={} fail (attempt {}), sonraki deneme {} sn sonra: {}",
                        id, e.getAttempts(), delay.toSeconds(), msg);
            }
        });
    }

    /**
     * Devre kesici acik (CallNotPermittedException): deneme sayilmaz, yalniz ertelenir.
     * Saglayiciya hic istek gitmedi; DLQ'ya "dokunmadan" dusmesin.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markDeferred(Long id, java.time.Duration delay, Exception ex) {
        outboxRepository.findById(id).ifPresent(e -> {
            e.setNextAttemptAt(LocalDateTime.now().plus(delay));
            e.setLastError(errorText(ex));
            outboxRepository.save(e);
            log.info("[OUTBOX-RELAY] event id={} devre acik, {} sn ertelendi (deneme sayilmadi)",
                    id, delay.toSeconds());
        });
    }

    private static String errorText(Exception ex) {
        String msg = ex.getClass().getSimpleName() + ": " + ex.getMessage();
        return msg.length() > 500 ? msg.substring(0, 500) : msg;
    }
}
