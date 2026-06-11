package com.hotelapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.entity.PushSubscription;
import com.hotelapp.repository.PushSubscriptionRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import nl.martijndwars.webpush.Utils;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.Security;
import java.util.HashMap;
import java.util.Map;

/**
 * FAZ 1/#23 — Web Push (VAPID) service.
 *
 * Sorumluluklar:
 *  - VAPID key'leri load (application.yml)
 *  - PushService bean'i init
 *  - sendNotification: belirli bir subscription'a push gönderir
 *  - sendToUser: kullanıcının TÜM subscription'larına push gönderir
 *  - Geçersiz subscription (404/410) otomatik silinir
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebPushService {

    private final PushSubscriptionRepository subscriptionRepository;

    @Value("${app.push.vapid.public-key:}")
    private String publicKey;

    @Value("${app.push.vapid.private-key:}")
    private String privateKey;

    @Value("${app.push.vapid.subject:mailto:admin@ajanshotel.com}")
    private String subject;

    private PushService pushService;

    public String getPublicKey() {
        return publicKey;
    }

    public boolean isConfigured() {
        return publicKey != null && !publicKey.isBlank()
            && privateKey != null && !privateKey.isBlank()
            && pushService != null;
    }

    @PostConstruct
    void init() {
        Security.addProvider(new BouncyCastleProvider());
        if (publicKey == null || publicKey.isBlank() || privateKey == null || privateKey.isBlank()) {
            log.warn("[WebPush] VAPID key'ler set edilmemiş. Push devre dışı. " +
                     "Üretmek için: openssl ecparam -genkey -name prime256v1 -out vapid_priv.pem");
            return;
        }
        try {
            this.pushService = new PushService(publicKey, privateKey, subject);
            log.info("[WebPush] VAPID configured (subject={})", subject);
        } catch (Exception e) {
            log.error("[WebPush] PushService init failed: {}", e.getMessage());
        }
    }

    /**
     * Bir kullanıcının tüm subscription'larına bildirim gönderir.
     * Async — caller (NotificationService.notify) blocked olmaz.
     *
     * payload: {"title":"...", "body":"...", "link":"..."}
     */
    @Async
    @Transactional
    public void sendToUser(Long userId, Map<String, String> payload) {
        if (!isConfigured()) return;
        var subscriptions = subscriptionRepository.findAllByUserId(userId);
        if (subscriptions.isEmpty()) return;

        String json;
        try {
            json = new ObjectMapper().writeValueAsString(payload);
        } catch (Exception e) {
            log.warn("[WebPush] Payload serialize failed: {}", e.getMessage());
            return;
        }

        for (PushSubscription sub : subscriptions) {
            try {
                Subscription wp = new Subscription(
                        sub.getEndpoint(),
                        new Subscription.Keys(sub.getP256dh(), sub.getAuth())
                );
                Notification notification = new Notification(wp, json);
                var response = pushService.send(notification);
                int status = response.getStatusLine().getStatusCode();

                // 404/410: subscription artık geçersiz → sil
                if (status == 404 || status == 410) {
                    log.info("[WebPush] Subscription expired ({}), removing: {}",
                             status, sub.getEndpoint());
                    subscriptionRepository.deleteById(sub.getId());
                } else if (status >= 400) {
                    log.warn("[WebPush] Push status={} for user={}", status, userId);
                }
            } catch (Exception e) {
                log.warn("[WebPush] Send failed for user={}: {}", userId, e.getMessage());
            }
        }
    }
}
