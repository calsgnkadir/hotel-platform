package com.hotelapp.controller;

import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * FAZ 1/#60 — Online durum (başlangıç state).
 *
 * Gizlilik: yalnız çağıranın sohbet karşı tarafları (aralarında engel olmayan)
 * görünür. Diğer kullanıcılar için yanıt "çevrimdışı, son görülme yok" ile aynıdır
 * (kullanıcının varlığı/çevrimiçi durumu ifşa edilmez).
 */
@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class PresenceController {

    private final PresenceService presenceService;

    @GetMapping("/online")
    public ResponseEntity<Set<Long>> online(@AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(presenceService.getOnlineUserIds(currentUser.getId()));
    }

    /** FAZ 11.W3 — Tek kullanicinin son gorulme zamani (online ise lastSeen=null + online=true). */
    @GetMapping("/last-seen/{userId}")
    public ResponseEntity<Map<String, Object>> lastSeen(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @PathVariable Long userId) {
        boolean visible = presenceService.canSee(currentUser.getId(), userId);
        boolean online = visible && presenceService.isOnline(userId);
        var lastSeen = visible ? presenceService.getLastSeen(userId) : null;
        Map<String, Object> body = new HashMap<>();
        body.put("online", online);
        body.put("lastSeenAt", online ? null : (lastSeen != null ? lastSeen.toString() : null));
        return ResponseEntity.ok(body);
    }
}
