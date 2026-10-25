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

    /** İş kuralı saati: Türkiye yerel saati, JVM saat diliminden bağımsız (testte sabitlenebilir). */
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

    private final OutboxEventRepository outboxRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markProcessed(Long id) {
        outboxRepository.findById(id).ifPresent(e -> {
            e.setProcessedAt(LocalDateTime.now(clock));
            if (OutboxService.TYPE_EMAIL.equals(e.getEventType())) {
                e.setPayload(redactDeliveredEmail(e.getPayload()));
            }
            outboxRepository.save(e);
        });
    }

    private static final com.fasterxml.jackson.databind.ObjectMapper JSON =
            new com.fasterxml.jackson.databind.ObjectMapper();

    /**
     * KVKK: teslim edilmis e-postanin govdesi (sifirlama/dogrulama baglantisi, ad-soyad)
     * 30 gunluk saklama boyunca DB'de durmasin. Teslim edilmis olay yeniden denenemez
     * (OutboxAdminService.retry guard'i), govdeye artik ihtiyac yok. Alici maskelenir,
     * konu gozlem icin kalir. Ayristirilamazsa govdesiz bos mesaj yazilir.
     */
    static String redactDeliveredEmail(String payload) {
        String to = null;
        String subject = null;
        try {
            var node = payload == null ? null : JSON.readTree(payload);
            if (node != null) {
                if (node.hasNonNull("to")) to = node.get("to").asText();
                if (node.hasNonNull("subject")) subject = node.get("subject").asText();
            }
        } catch (Exception ignored) {
            // bozuk payload: alici/konu bilinmiyor, yine de govde silinir
        }
        try {
            return JSON.writeValueAsString(new com.hotelapp.event.EmailMessage(
                    com.hotelapp.security.PiiMasking.email(to),
                    com.hotelapp.security.PiiMasking.scrub(subject),
                    ""));
        } catch (Exception ex) {
            return "{}";
        }
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
                e.setNextAttemptAt(LocalDateTime.now(clock).plus(delay));
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
            e.setNextAttemptAt(LocalDateTime.now(clock).plus(delay));
            e.setLastError(errorText(ex));
            outboxRepository.save(e);
            log.info("[OUTBOX-RELAY] event id={} devre acik, {} sn ertelendi (deneme sayilmadi)",
                    id, delay.toSeconds());
        });
    }

    /**
     * KVKK: saglayici hata metni alici adresi/yanit govdesi icerebilir. last_error ve
     * loga yalniz hata sinifi + (varsa) HTTP durum kodu + maskeli kisa mesaj yazilir.
     */
    static String errorText(Exception ex) {
        StringBuilder sb = new StringBuilder(ex.getClass().getSimpleName());
        Integer status = httpStatusOf(ex);
        if (status != null) sb.append(" HTTP ").append(status);
        String raw = ex.getMessage();
        if (raw != null && !raw.isBlank()) {
            String masked = com.hotelapp.security.PiiMasking.scrub(raw);
            if (masked.length() > 300) masked = masked.substring(0, 300) + "…";
            sb.append(": ").append(masked);
        }
        return sb.toString();
    }

    private static Integer httpStatusOf(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof org.springframework.web.client.RestClientResponseException r) {
                return r.getStatusCode().value();
            }
            if (t.getCause() == t) break;
        }
        return null;
    }
}
