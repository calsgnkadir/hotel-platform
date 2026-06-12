package com.hotelapp.service;

import com.hotelapp.entity.PushSubscription;
import com.hotelapp.repository.PushSubscriptionRepository;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * FAZ 1/#23 — Push gonderici.
 *
 * MVP: payload encryption YOK (Bouncycastle/AES-GCM tabaka gerekmesin).
 * - HTTP POST body bos
 * - Service worker'a "push" event tetikleyicisi gider
 * - Service worker payload yoksa /api/notifications endpoint'inden son okunmamis bildirimi cekip gosterir
 *
 * Push server hata kodlari:
 *  - 410 Gone / 404 Not Found  => abonelik artik gecersiz, sil
 *  - 413 Payload Too Large     => N/A (body bos)
 *  - 429 Too Many Requests     => retry-after sonra denenebilir (su an yutuyoruz)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebPushService {

    private final VapidService vapidService;
    private final PushSubscriptionRepository subscriptionRepository;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /** Tum aboneliklere push gonder. Yeni thread'de fire-forget (caller transaction'i bloklamaz). */
    @Transactional(readOnly = true)
    public void sendToUser(Long userId) {
        // Fire-forget: yeni thread, ana request'i bloklamaz, hata yutulur.
        new Thread(() -> doSend(userId), "push-send-" + userId).start();
    }

    private void doSend(Long userId) {
        List<PushSubscription> subs = subscriptionRepository.findAllByUserId(userId);
        for (PushSubscription sub : subs) {
            try {
                int status = pushOne(sub);
                if (status == 404 || status == 410) {
                    log.info("Push abonelik artik gecersiz, siliniyor: id={}", sub.getId());
                    subscriptionRepository.delete(sub);
                } else if (status >= 400) {
                    log.warn("Push fail: id={} status={}", sub.getId(), status);
                }
            } catch (Exception e) {
                log.warn("Push gonderim hatasi: id={} - {}", sub.getId(), e.getMessage());
            }
        }
    }

    // FAZ 2/#18: FCM/Mozilla push server cevap vermiyorsa devre acilir
    @CircuitBreaker(name = "webpush", fallbackMethod = "pushFallback")
    private int pushOne(PushSubscription sub) throws Exception {
        String endpoint = sub.getEndpoint();
        String auth = vapidService.buildAuthHeader(endpoint);
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(8))
                .header("Authorization", auth)
                .header("TTL", "60")              // sn
                .header("Urgency", "normal")
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        // Body capture: 403/410 vs gelirse FCM sebep aciklamasi log'a dussun
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) {
            log.warn("Push HTTP {} - endpoint={} body={}",
                    res.statusCode(),
                    endpoint.substring(0, Math.min(60, endpoint.length())),
                    res.body());
        }
        return res.statusCode();
    }

    /** FAZ 2/#18 - Circuit breaker fallback: push server down ise sessizce 0 don */
    @SuppressWarnings("unused")
    private int pushFallback(PushSubscription sub, Throwable t) {
        log.warn("[PUSH][CB-FALLBACK] Push server devre disi - id={} sebep={}",
                sub.getId(), t.getMessage());
        return 0;  // 0 = fallback, retry yapilmaz, abone silinmez
    }
}
