package com.hotelapp.controller;

import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.User;
import com.hotelapp.repository.BusinessBlockRepository;
import com.hotelapp.repository.CandidateBlockRepository;
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
 * FAZ 1/#60 — "Yazıyor..." göstergesi (typing indicator).
 *
 * Akış:
 *   Client (yazmaya başlar) → /app/chat.typing/{conversationId}
 *   Server: doğrula → /topic/typing.{conversationId}'ye yayın
 *   Abonelik yalnız sohbet üyelerine açık (StompAuthorizationInterceptor).
 *
 * Yayınlanmaz: gönderen sohbet üyesi değilse, hesabı kapalıysa ya da taraflar
 * arasında herhangi bir yönde engel varsa (engel karşı tarafa ifşa edilmez —
 * sinyal sessizce düşer).
 *
 * Persistent state YOK — sadece transient broadcast. Her tuşta gelebildiği için
 * log DEBUG seviyesinde ve kişisel veri (e-posta) içermez.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWsController {

    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final CandidateBlockRepository candidateBlockRepository;
    private final BusinessBlockRepository businessBlockRepository;

    /**
     * Yazıyor sinyali.
     * Frontend her birkaç saniyede bir gönderir; karşı taraf timeout ile silebilir.
     */
    @MessageMapping("/chat.typing/{conversationId}")
    public void onTyping(@DestinationVariable Long conversationId, Principal principal) {
        if (principal == null) {
            log.debug("[TYPING] principal yok, atlandi conv={}", conversationId);
            return;
        }

        User sender = userRepository.findByEmail(principal.getName()).orElse(null);
        if (sender == null || !sender.isEnabled()) {
            log.debug("[TYPING] gonderen yok/kapali, atlandi conv={}", conversationId);
            return;
        }

        Conversation conv = conversationRepository.findById(conversationId).orElse(null);
        if (conv == null) {
            log.debug("[TYPING] sohbet yok conv={}", conversationId);
            return;
        }

        Long candidateId = conv.getCandidate().getId();
        Long ownerId     = conv.getBusinessOwner().getId();
        if (!sender.getId().equals(candidateId) && !sender.getId().equals(ownerId)) {
            log.debug("[TYPING] yetkisiz user={} conv={}", sender.getId(), conversationId);
            return;
        }

        // Engel kurali (iki yon): mesaj gonderimi kapaliysa yaziyor sinyali de gitmez
        if (candidateBlockRepository.existsByBusinessOwnerIdAndCandidateId(ownerId, candidateId)
                || businessBlockRepository.existsByUserIdAndBusinessOwnerId(candidateId, ownerId)) {
            log.debug("[TYPING] engel nedeniyle yayinlanmadi conv={}", conversationId);
            return;
        }

        TypingPayload payload = new TypingPayload(
                conversationId,
                sender.getId(),
                sender.getFullName()
        );
        // /topic/typing.{conversationId} → yalniz sohbet uyeleri abone olabilir.
        // Frontend kendi senderId == myUserId ise gormezden gelir (sonsuz loop yok).
        messagingTemplate.convertAndSend(
                "/topic/typing." + conversationId,
                payload
        );
    }

    public record TypingPayload(Long conversationId, Long userId, String userName) {}
}
