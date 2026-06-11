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
        if (principal == null) return;

        // principal.getName() → email (userDetails.getUsername())
        User sender = userRepository.findByEmail(principal.getName()).orElse(null);
        if (sender == null) return;

        Conversation conv = conversationRepository.findById(conversationId).orElse(null);
        if (conv == null) return;

        // Yetki: gönderen bu sohbetin tarafı olmalı
        Long candidateId = conv.getCandidate().getId();
        Long ownerId     = conv.getBusinessOwner().getId();
        if (!sender.getId().equals(candidateId) && !sender.getId().equals(ownerId)) {
            log.warn("Typing broadcast unauthorized: user={} conv={}", sender.getId(), conversationId);
            return;
        }

        Long recipientId = sender.getId().equals(candidateId) ? ownerId : candidateId;

        TypingPayload payload = new TypingPayload(
                conversationId,
                sender.getId(),
                sender.getFullName()
        );
        messagingTemplate.convertAndSendToUser(
                recipientId.toString(),
                "/queue/typing",
                payload
        );
    }

    public record TypingPayload(Long conversationId, Long userId, String userName) {}
}
