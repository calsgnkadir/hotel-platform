package com.hotelapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.entity.PushSubscription;
import com.hotelapp.repository.PushSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Push gönderici.
 *
 * İçerik (başlık, metin, açılacak sayfa) RFC 8291'e göre şifrelenip gönderilir
 * (WebPushEncryption); push sunucusu içeriği okuyamaz. Aboneliğin anahtarları
 * yoksa (eski kayıt) boş gövdeli push gider, service worker genel metin gösterir;
 * kullanıcı bir sonraki girişte anahtarlarla yeniden kaydolur.
 *
 * Push sunucusu hata kodları:
 *  - 410 Gone / 404 Not Found  => abonelik artık geçersiz, sil
 *  - 413 Payload Too Large     => içerik kırpılarak önlenir
 *  - 429 Too Many Requests     => yutulur
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebPushService {

    /** Telefon kapalıysa push sunucusu mesajı bu kadar saklar (vardiya haberi geç de olsa gelsin). */
    static final String TTL_SECONDS = String.valueOf(Duration.ofHours(24).toSeconds());
    private static final int MAX_BODY_CHARS = 180;

    private final VapidService vapidService;
    private final PushSubscriptionRepository subscriptionRepository;
    private final ObjectMapper objectMapper;
    private final PushEndpointPolicy endpointPolicy;
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    /** Bildirim içeriği; url uygulama içi tam adres (ör. /candidate?tab=applications). */
    public record PushMessage(String title, String body, String url, Long notificationId) {}

    /** Kullanıcının tüm aboneliklerine gönderir. Yeni thread'de, çağıranı bekletmez. */
    public void sendToUser(Long userId, PushMessage message) {
        new Thread(() -> doSend(userId, message), "push-send-" + userId).start();
    }

    void doSend(Long userId, PushMessage message) {
        byte[] payload = toJson(message);
        List<PushSubscription> subs = subscriptionRepository.findAllByUserId(userId);
        for (PushSubscription sub : subs) {
            // Doğrulamadan önce kaydedilmiş adresler de istek atılmadan elenir (SSRF)
            if (!endpointPolicy.isAllowed(sub.getEndpoint())) {
                log.warn("Push adresi izinli servis degil, abonelik siliniyor: id={}", sub.getId());
                subscriptionRepository.delete(sub);
                continue;
            }
            try {
                int status = pushOne(sub, payload);
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

    private int pushOne(PushSubscription sub, byte[] payload) throws Exception {
        String endpoint = sub.getEndpoint();
        HttpRequest.Builder req = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(8))
                .header("Authorization", vapidService.buildAuthHeader(endpoint))
                .header("TTL", TTL_SECONDS)
                .header("Urgency", "normal");

        byte[] encrypted = encryptFor(sub, payload);
        if (encrypted != null) {
            req.header("Content-Encoding", "aes128gcm")
               .header("Content-Type", "application/octet-stream")
               .POST(HttpRequest.BodyPublishers.ofByteArray(encrypted));
        } else {
            req.POST(HttpRequest.BodyPublishers.noBody());
        }

        HttpResponse<String> res = http.send(req.build(), HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() >= 400) {
            log.warn("Push HTTP {} - endpoint={} body={}",
                    res.statusCode(),
                    endpoint.substring(0, Math.min(60, endpoint.length())),
                    res.body());
        }
        return res.statusCode();
    }

    /** Anahtar yoksa ya da şifreleme düşerse null → içeriksiz (genel) push. */
    private byte[] encryptFor(PushSubscription sub, byte[] payload) {
        if (payload == null || isBlank(sub.getP256dh()) || isBlank(sub.getAuthSecret())) return null;
        try {
            return WebPushEncryption.encrypt(payload, sub.getP256dh(), sub.getAuthSecret());
        } catch (Exception e) {
            log.warn("Push sifrelenemedi, icerik olmadan gonderiliyor: id={} - {}", sub.getId(), e.getMessage());
            return null;
        }
    }

    byte[] toJson(PushMessage m) {
        if (m == null) return null;
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("title", truncate(m.title(), 80));
        json.put("body", truncate(m.body(), MAX_BODY_CHARS));
        json.put("link", m.url() != null ? m.url() : "/");
        if (m.notificationId() != null) json.put("notificationId", m.notificationId());
        try {
            return objectMapper.writeValueAsString(json).getBytes(StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("Push icerigi hazirlanamadi: {}", e.getMessage());
            return null;
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
