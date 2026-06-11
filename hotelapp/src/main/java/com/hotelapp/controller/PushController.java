package com.hotelapp.controller;

import com.hotelapp.entity.PushSubscription;
import com.hotelapp.entity.User;
import com.hotelapp.repository.PushSubscriptionRepository;
import com.hotelapp.service.WebPushService;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * FAZ 1/#23 — Web Push endpoint'leri.
 *
 *  GET  /api/push/vapid-public-key  → VAPID public key (anon erişilebilir olabilir)
 *  POST /api/push/subscribe         → Browser subscription kaydet
 *  POST /api/push/unsubscribe       → endpoint sil
 */
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final WebPushService webPushService;
    private final PushSubscriptionRepository subscriptionRepository;

    @GetMapping("/vapid-public-key")
    public ResponseEntity<Map<String, String>> vapidPublicKey() {
        return ResponseEntity.ok(Map.of(
                "publicKey", webPushService.getPublicKey() == null ? "" : webPushService.getPublicKey(),
                "configured", String.valueOf(webPushService.isConfigured())
        ));
    }

    @PostMapping("/subscribe")
    @Transactional
    public ResponseEntity<Map<String, Object>> subscribe(
            @AuthenticationPrincipal User user,
            @RequestBody SubscribeRequest req) {
        var existing = subscriptionRepository.findByUserIdAndEndpoint(user.getId(), req.getEndpoint());
        if (existing.isPresent()) {
            return ResponseEntity.ok(Map.of("ok", true, "already", true));
        }
        PushSubscription sub = PushSubscription.builder()
                .user(user)
                .endpoint(req.getEndpoint())
                .p256dh(req.getKeys().getP256dh())
                .auth(req.getKeys().getAuth())
                .build();
        subscriptionRepository.save(sub);
        return ResponseEntity.ok(Map.of("ok", true, "id", sub.getId()));
    }

    @PostMapping("/unsubscribe")
    @Transactional
    public ResponseEntity<Map<String, Boolean>> unsubscribe(
            @AuthenticationPrincipal User user,
            @RequestBody UnsubscribeRequest req) {
        int deleted = subscriptionRepository.deleteByUserIdAndEndpoint(user.getId(), req.getEndpoint());
        return ResponseEntity.ok(Map.of("ok", deleted > 0));
    }

    @Data
    public static class SubscribeRequest {
        @NotBlank private String endpoint;
        private Keys keys;
        @Data public static class Keys {
            @NotBlank private String p256dh;
            @NotBlank private String auth;
        }
    }

    @Data
    public static class UnsubscribeRequest {
        @NotBlank private String endpoint;
    }
}
