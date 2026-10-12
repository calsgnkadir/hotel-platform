package com.hotelapp.service;

import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.User;
import com.hotelapp.repository.BusinessBlockRepository;
import com.hotelapp.repository.CandidateBlockRepository;
import com.hotelapp.repository.ConversationRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Instant;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * FAZ 1/#60 — Online presence (gizlilik: yalnız sohbet karşı tarafları).
 *
 * STOMP CONNECT/DISCONNECT event'lerini dinler, online kullanıcıların oturumlarını tutar.
 * Durum değişikliği HERKESE yayınlanmaz: yalnız kullanıcının sohbet karşı taraflarına
 * (aralarında herhangi bir yönde engel olmayan) {@code /user/queue/presence} ile gider.
 * REST sorguları da aynı kuralla süzülür.
 *
 * Frontend:
 *  - GET /api/presence/online → başlangıç state (yalnız karşı tarafların online id seti)
 *  - WS sub /user/queue/presence → değişiklik event'leri (eskiden /topic/presence)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PresenceService {

    static final String PRESENCE_QUEUE = "/queue/presence";

    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;
    private final CandidateBlockRepository candidateBlockRepository;
    private final BusinessBlockRepository businessBlockRepository;

    /** userId → açık STOMP oturum id'leri (çoklu sekme). */
    private final ConcurrentHashMap<Long, Set<String>> sessionsByUserId = new ConcurrentHashMap<>();

    /** userId → Principal adı (e-posta; convertAndSendToUser hedefi). Yalnız bellekte, loglanmaz. */
    private final ConcurrentHashMap<Long, String> principalNameByUserId = new ConcurrentHashMap<>();

    /** FAZ 11.W3 — userId → son cikis zamani. In-memory (restart'ta sifirlanir). */
    private final ConcurrentHashMap<Long, Instant> lastSeenByUserId = new ConcurrentHashMap<>();

    @EventListener
    public void onConnect(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        Long userId = resolveUserId(accessor.getUser());
        if (userId == null || sessionId == null) return;

        principalNameByUserId.put(userId, accessor.getUser().getName());
        boolean[] first = {false};
        sessionsByUserId.compute(userId, (k, set) -> {
            Set<String> s = set != null ? set : Collections.synchronizedSet(new HashSet<>());
            first[0] = s.isEmpty();
            s.add(sessionId);
            return s;
        });

        if (first[0]) {
            log.debug("[PRESENCE] online userId={}", userId);
            publishToCounterparts(userId, new PresencePayload(userId, true));
        }
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        Long userId = resolveUserId(accessor.getUser());
        if (userId == null || sessionId == null) return;

        boolean[] last = {false};
        sessionsByUserId.computeIfPresent(userId, (k, set) -> {
            set.remove(sessionId);
            if (set.isEmpty()) {
                last[0] = true;
                return null;   // map'ten kaldir
            }
            return set;
        });

        if (last[0]) {
            Instant now = Instant.now();
            lastSeenByUserId.put(userId, now);
            log.debug("[PRESENCE] offline userId={}", userId);
            publishToCounterparts(userId, new PresencePayload(userId, false, now));
            principalNameByUserId.remove(userId);
        }
    }

    /** viewer'ın görebileceği (sohbet karşı tarafı, engelsiz) online kullanıcı id'leri. */
    public Set<Long> getOnlineUserIds(Long viewerId) {
        Set<Long> result = new HashSet<>(counterpartIds(viewerId));
        result.retainAll(sessionsByUserId.keySet());
        return result;
    }

    /** viewer, userId'nin çevrimiçi durumunu görebilir mi (sohbet karşı tarafı + engel yok). */
    public boolean canSee(Long viewerId, Long userId) {
        return viewerId != null && userId != null && counterpartIds(viewerId).contains(userId);
    }

    /** Toplam çevrimiçi kullanıcı sayısı (kimlik içermeyen topluluk sayacı — PulseService). */
    public int onlineUserCount() {
        return sessionsByUserId.size();
    }

    public boolean isOnline(Long userId) {
        return sessionsByUserId.containsKey(userId);
    }

    /** FAZ 11.W3 — Kullanicinin son cikis zamani (online ise null; hic gorulmemisse null). */
    public Instant getLastSeen(Long userId) {
        return lastSeenByUserId.get(userId);
    }

    /**
     * Kullanıcının sohbet karşı tarafları; iki yönden herhangi birinde engel olanlar hariç.
     * Engel aday↔işletme sahibi düzeyinde değerlendirilir.
     */
    Set<Long> counterpartIds(Long userId) {
        Set<Long> ids = new HashSet<>();
        if (userId == null) return ids;
        for (Conversation c : conversationRepository.findAllForUser(userId)) {
            Long candidateId = c.getCandidate().getId();
            Long ownerId = c.getBusinessOwner().getId();
            ids.add(userId.equals(candidateId) ? ownerId : candidateId);
        }
        if (ids.isEmpty()) return ids;
        // Kullanıcı aday olarak: onu engelleyen ve onun engellediği işletme sahipleri
        ids.removeAll(candidateBlockRepository.findBusinessOwnerIdsByCandidateId(userId));
        ids.removeAll(businessBlockRepository.findBusinessOwnerIdsByUserId(userId));
        // Kullanıcı işletme sahibi olarak: engellediği ve onu engelleyen adaylar
        ids.removeAll(candidateBlockRepository.findCandidateIdsByBusinessOwnerId(userId));
        ids.removeAll(businessBlockRepository.findUserIdsByBusinessOwnerId(userId));
        return ids;
    }

    private void publishToCounterparts(Long userId, PresencePayload payload) {
        try {
            for (Long other : counterpartIds(userId)) {
                String name = principalNameByUserId.get(other);
                if (name == null) continue;   // karşı taraf çevrimdışı: gönderilecek oturum yok
                messagingTemplate.convertAndSendToUser(name, PRESENCE_QUEUE, payload);
            }
        } catch (Exception e) {
            log.warn("[PRESENCE] yayin basarisiz userId={}: {}", userId, e.getMessage());
        }
    }

    private Long resolveUserId(Principal principal) {
        if (principal == null) return null;
        if (principal instanceof Authentication auth && auth.getPrincipal() instanceof UserPrincipal up) {
            return up.getId();
        }
        return userRepository.findByEmail(principal.getName()).map(User::getId).orElse(null);
    }

    /** FAZ 11.W3 — lastSeenAt: offline event'te dolu, online event'te null. */
    public record PresencePayload(Long userId, boolean online, Instant lastSeenAt) {
        public PresencePayload(Long userId, boolean online) { this(userId, online, null); }
    }
}
