package com.hotelapp.controller;

import com.hotelapp.entity.PushSubscription;
import com.hotelapp.repository.PushSubscriptionRepository;
import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.VapidService;
import jakarta.transaction.Transactional;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * FAZ 1/#23 — Push abonelik endpoint'leri.
 */
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final VapidService vapidService;
    private final PushSubscriptionRepository repo;

    /** Public — frontend tarayicidan subscribe ederken bu key'i kullanir. */
    @GetMapping("/vapid-public-key")
    public Map<String, String> vapidPublicKey() {
        return Map.of("publicKey", vapidService.getPublicKey());
    }

    /** Yeni abonelik kaydet (ayni endpoint varsa update). */
    @PostMapping("/subscribe")
    @Transactional
    public ResponseEntity<Void> subscribe(@AuthenticationPrincipal UserPrincipal currentUser,
                                          @RequestBody SubscriptionDto body) {
        if (currentUser == null || body == null || body.endpoint == null) {
            return ResponseEntity.badRequest().build();
        }
        PushSubscription sub = repo.findByEndpoint(body.endpoint)
                .orElseGet(() -> PushSubscription.builder()
                        .endpoint(body.endpoint)
                        .build());
        sub.setUser(currentUser.getUser());
        sub.setP256dh(body.p256dh);
        sub.setAuthSecret(body.auth);
        repo.save(sub);
        return ResponseEntity.ok().build();
    }

    /** Aboneligi sil (kullanici browser bildirim izinini kaldirinca). */
    @DeleteMapping("/subscribe")
    @Transactional
    public ResponseEntity<Void> unsubscribe(@RequestBody SubscriptionDto body) {
        if (body == null || body.endpoint == null) return ResponseEntity.badRequest().build();
        repo.deleteByEndpoint(body.endpoint);
        return ResponseEntity.noContent().build();
    }

    @Data
    public static class SubscriptionDto {
        private String endpoint;
        private String p256dh;
        private String auth;
    }
}
