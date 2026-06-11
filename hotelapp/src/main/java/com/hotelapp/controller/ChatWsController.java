package com.hotelapp.controller;

import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.User;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ConversationRepository;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * FAZ 1/#60 — "Yazıyor..." göstergesi (typing indicator) + presence.
 *
 * Akış:
 *   Client (yazmaya başlar) → /app/chat.typing/{conversationId}
 *   Server: doğrula → /user/{otherPartyId}/queue/typing'e push
 *   Other client (sub'lı): "X yazıyor..." UI'da göster
 *
 * Persistent state YOK — sadece transient broadcast.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWsController {

    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Yazıyor sinyali.
     * Frontend her birkaç saniyede bir gönderir; karşı taraf timeout ile silebilir.
     */
    @MessageMapping("/chat.typing/{conversationId}")
    public void onTyping(@DestinationVariable Long conversationId, Principal principal) {
        log.info("[TYPING] received: conv={} principal={}", conversationId,
                 principal == null ? "NULL" : principal.getName());
        if (principal == null) {
            log.warn("[TYPING] principal NULL — STOMP CONNECT auth basarisiz olmus");
            return;
        }

        User sender = userRepository.findByEmail(principal.getName()).orElse(null);
        if (sender == null) {
            log.warn("[TYPING] sender bulunamadi: {}", principal.getName());
            return;
        }

        Conversation conv = conversationRepository.findById(conversationId).orElse(null);
        if (conv == null) {
            log.warn("[TYPING] conversation bulunamadi: {}", conversationId);
            return;
        }

        Long candidateId = conv.getCandidate().getId();
        Long ownerId     = conv.getBusinessOwner().getId();
        if (!sender.getId().equals(candidateId) && !sender.getId().equals(ownerId)) {
            log.warn("[TYPING] unauthorized: user={} conv={}", sender.getId(), conversationId);
            return;
        }

        boolean iAmCandidate = sender.getId().equals(candidateId);
        User recipient = iAmCandidate ? conv.getBusinessOwner() : conv.getCandidate();

        TypingPayload payload = new TypingPayload(
                conversationId,
                sender.getId(),
                sender.getFullName()
        );
        // FIX: convertAndSendToUser, userId'yi Principal.getName() ile eslestirir.
        // Bizim Principal.getName() = email, bu yuzden id yerine EMAIL kullaniyoruz.
        log.info("[TYPING] push: from={} to={} ({}) conv={}",
                 sender.getId(), recipient.getId(), recipient.getEmail(), conversationId);
        messagingTemplate.convertAndSendToUser(
                recipient.getEmail(),
                "/queue/typing",
                payload
        );
    }

    public record TypingPayload(Long conversationId, Long userId, String userName) {}
}
