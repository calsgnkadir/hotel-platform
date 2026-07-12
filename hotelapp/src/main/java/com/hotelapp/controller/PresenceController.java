package com.hotelapp.controller;

import com.hotelapp.service.PresenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

/**
 * FAZ 1/#60 — Online user listesi (başlangıç state).
 */
@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class PresenceController {

    private final PresenceService presenceService;

    @GetMapping("/online")
    public ResponseEntity<Set<Long>> online() {
        return ResponseEntity.ok(presenceService.getOnlineUserIds());
    }

    /** FAZ 11.W3 — Tek kullanicinin son gorulme zamani (online ise lastSeen=null + online=true). */
    @GetMapping("/last-seen/{userId}")
    public ResponseEntity<java.util.Map<String, Object>> lastSeen(
            @org.springframework.web.bind.annotation.PathVariable Long userId) {
        boolean online = presenceService.getOnlineUserIds().contains(userId);
        var lastSeen = presenceService.getLastSeen(userId);
        var body = new java.util.HashMap<String, Object>();
        body.put("online", online);
        body.put("lastSeenAt", online ? null : (lastSeen != null ? lastSeen.toString() : null));
        return ResponseEntity.ok(body);
    }
}
