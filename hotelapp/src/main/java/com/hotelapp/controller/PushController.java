package com.hotelapp.controller;

import com.hotelapp.entity.PushSubscription;
import com.hotelapp.repository.PushSubscriptionRepository;
import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.VapidService;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
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
                                          @Valid @RequestBody SubscriptionDto body) {
        if (currentUser == null) {
            return ResponseEntity.badRequest().build();
        }
        // Ayni tarayici baska bir hesapla girerse kayit yeni kullaniciya gecer
        // (ortak cihazda bildirim eski kullaniciya gitmesin).
        PushSubscription sub = repo.findByEndpoint(body.endpoint)
                .orElseGet(() -> PushSubscription.builder()
                        .endpoint(body.endpoint)
                        .build());
        sub.setUser(currentUser.getUser());
        sub.setP256dh(body.p256dhKey());
        sub.setAuthSecret(body.authKey());
        repo.save(sub);
        return ResponseEntity.ok().build();
    }

    /**
     * Aboneligi sil: kullanici bildirimi kapatinca veya cikis yapinca.
     * Sadece kendi kaydini silebilir.
     */
    @PostMapping("/unsubscribe")
    @Transactional
    public ResponseEntity<Void> unsubscribe(@AuthenticationPrincipal UserPrincipal currentUser,
                                            @Valid @RequestBody SubscriptionDto body) {
        if (currentUser == null) {
            return ResponseEntity.badRequest().build();
        }
        repo.findByEndpoint(body.endpoint)
                .filter(s -> s.getUser().getId().equals(currentUser.getId()))
                .ifPresent(repo::delete);
        return ResponseEntity.noContent().build();
    }

    /**
     * Tarayicinin PushSubscription.toJSON() bicimi: { endpoint, keys: { p256dh, auth } }.
     * Eski duz bicim (p256dh, auth) de kabul edilir.
     */
    @Data
    public static class SubscriptionDto {
        @NotBlank
        private String endpoint;
        private String p256dh;
        private String auth;
        private Map<String, String> keys;

        String p256dhKey() { return p256dh != null ? p256dh : (keys != null ? keys.get("p256dh") : null); }
        String authKey()   { return auth != null ? auth : (keys != null ? keys.get("auth") : null); }
    }
}
