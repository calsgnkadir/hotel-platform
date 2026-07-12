package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * FAZ 1/#60 — Online presence.
 *
 * STOMP CONNECT/DISCONNECT event'lerini dinler, online user id seti tutar.
 * Connect/disconnect'te /topic/presence'a payload yayar.
 *
 * Frontend:
 *  - GET /api/presence/online → başlangıç state (online id seti)
 *  - WS sub /topic/presence → değişiklik event'leri
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PresenceService {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;

    /** email → userId (multi-tab durumunda sayım için sessionId set'i tutulur) */
    private final ConcurrentHashMap<String, Set<String>> emailToSessions = new ConcurrentHashMap<>();

    /** FAZ 11.W3 — userId → son cikis zamani. In-memory (restart'ta sifirlanir,
     *  kritik degil — 'son gorulme' UX iyilestirmesi, audit degil). */
    private final ConcurrentHashMap<Long, java.time.Instant> lastSeenByUserId = new ConcurrentHashMap<>();

    @EventListener
    public void onConnect(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        Authentication auth = (Authentication) accessor.getUser();
        if (auth == null || sessionId == null) return;

        String email = auth.getName();
        emailToSessions.computeIfAbsent(email, k -> Collections.synchronizedSet(new HashSet<>()))
                       .add(sessionId);

        // Yeni email mi (ilk session)? Diğerlerine bildir.
        if (emailToSessions.get(email).size() == 1) {
            userRepository.findByEmail(email).ifPresent(u -> {
                log.info("[PRESENCE] online: {} (userId={})", email, u.getId());
                messagingTemplate.convertAndSend("/topic/presence",
                        new PresencePayload(u.getId(), true));
            });
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        Authentication auth = (Authentication) accessor.getUser();
        if (auth == null || sessionId == null) return;

        String email = auth.getName();
        Set<String> sessions = emailToSessions.get(email);
        if (sessions == null) return;
        sessions.remove(sessionId);

        // Son session da kapandıysa offline yay
        if (sessions.isEmpty()) {
            emailToSessions.remove(email);
            userRepository.findByEmail(email).ifPresent(u -> {
                log.info("[PRESENCE] offline: {} (userId={})", email, u.getId());
                // FAZ 11.W3 — son gorulme kaydi
                lastSeenByUserId.put(u.getId(), java.time.Instant.now());
                messagingTemplate.convertAndSend("/topic/presence",
                        new PresencePayload(u.getId(), false, java.time.Instant.now()));
            });
        }
    }

    /** Mevcut online user id setini döndürür (REST endpoint kullanır). */
    public Set<Long> getOnlineUserIds() {
        Set<Long> result = new HashSet<>();
        emailToSessions.keySet().forEach(email ->
            userRepository.findByEmail(email).ifPresent(u -> result.add(u.getId()))
        );
        return result;
    }

    /** FAZ 11.W3 — Kullanicinin son cikis zamani (online ise null; hic gorulmemisse null). */
    public java.time.Instant getLastSeen(Long userId) {
        return lastSeenByUserId.get(userId);
    }

    /** FAZ 11.W3 — lastSeenAt: offline event'te dolu, online event'te null. */
    public record PresencePayload(Long userId, boolean online, java.time.Instant lastSeenAt) {
        public PresencePayload(Long userId, boolean online) { this(userId, online, null); }
    }
}
