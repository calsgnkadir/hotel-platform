package com.hotelapp.service;

import com.hotelapp.dto.MessageRequest;
import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.Message;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessBlockRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.CandidateBlockRepository;
import com.hotelapp.repository.ConversationRepository;
import com.hotelapp.repository.MessageReactionRepository;
import com.hotelapp.repository.MessageRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Mesaj WS yayini dis transaction commit edildikten SONRA; rollback'te yayin yok. */
class MessageBroadcastAfterCommitTest {

    private static final long CANDIDATE = 1L, OWNER = 2L, CONV = 10L;

    private SimpMessagingTemplate ws;
    private MessageService service;
    private MessageRepository messages;
    private MessageReactionRepository reactions;
    private Conversation conv;

    private static User user(long id, Role role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        u.setFullName("Kullanici " + id);
        u.setEmail("u" + id + "@test.local");
        u.setEnabled(true);
        return u;
    }

    @BeforeEach
    void setUp() {
        ConversationRepository conversations = mock(ConversationRepository.class);
        messages = mock(MessageRepository.class);
        reactions = mock(MessageReactionRepository.class);
        UserRepository users = mock(UserRepository.class);
        ws = mock(SimpMessagingTemplate.class);
        service = new MessageService(conversations, messages, reactions, users,
                mock(ApplicationRepository.class), mock(NotificationService.class), mock(FileStorageService.class),
                ws, mock(BusinessBlockRepository.class), mock(CandidateBlockRepository.class),
                mock(BusinessRepository.class));

        User candidate = user(CANDIDATE, Role.CANDIDATE);
        User owner = user(OWNER, Role.BUSINESS_OWNER);
        conv = Conversation.builder().id(CONV).candidate(candidate).businessOwner(owner).build();
        when(users.findById(CANDIDATE)).thenReturn(Optional.of(candidate));
        when(users.findById(OWNER)).thenReturn(Optional.of(owner));
        when(conversations.findById(CONV)).thenReturn(Optional.of(conv));
        when(conversations.save(any())).thenAnswer(i -> i.getArgument(0));
        when(messages.save(any())).thenAnswer(i -> {
            Message m = i.getArgument(0);
            m.setId(99L);
            m.setSentAt(LocalDateTime.now());
            return m;
        });
    }

    @AfterEach
    void clearSync() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private static MessageRequest text(String content) {
        MessageRequest r = new MessageRequest();
        r.setContent(content);
        return r;
    }

    @Test
    @DisplayName("Commit oncesi yayin yok; commit sonrasi iki tarafa gider")
    void broadcastAfterCommit() {
        TransactionSynchronizationManager.initSynchronization();

        service.sendMessage(CONV, CANDIDATE, text("merhaba"));
        verifyNoInteractions(ws);

        TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
        verify(ws).convertAndSendToUser(eq("u1@test.local"), eq("/queue/messages"), any());
        verify(ws).convertAndSendToUser(eq("u2@test.local"), eq("/queue/messages"), any());
    }

    @Test
    @DisplayName("Mesaj kaydi geri alinirsa WS yayini yapilmaz")
    void rollback_noBroadcast() {
        TransactionSynchronizationManager.initSynchronization();

        service.sendMessage(CONV, CANDIDATE, text("merhaba"));
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

        verifyNoInteractions(ws);
    }

    @Test
    @DisplayName("Transaction yoksa hemen yayinlanir")
    void noTransaction_immediate() {
        service.sendMessage(CONV, CANDIDATE, text("merhaba"));
        verify(ws, times(2)).convertAndSendToUser(any(), eq("/queue/messages"), any());
    }

    // ── Reaksiyon yayini da commit sonrasi ───────────────────────────

    private void stubReactionTarget() {
        Message target = Message.builder().id(5L).conversation(conv).content("x").build();
        when(messages.findById(5L)).thenReturn(Optional.of(target));
        when(reactions.findByMessageIdAndUserId(5L, CANDIDATE)).thenReturn(Optional.empty());
        when(reactions.findAllByMessageId(5L)).thenReturn(java.util.List.of());
    }

    @Test
    @DisplayName("Reaksiyon: commit oncesi WS yayini yok, commit sonrasi iki tarafa")
    void reactionBroadcastAfterCommit() {
        stubReactionTarget();
        TransactionSynchronizationManager.initSynchronization();

        service.toggleReaction(CONV, 5L, CANDIDATE, "heart");
        verifyNoInteractions(ws);

        TransactionSynchronizationManager.getSynchronizations()
                .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_COMMITTED));
        verify(ws).convertAndSendToUser(eq("u1@test.local"), eq("/queue/reactions"), any());
        verify(ws).convertAndSendToUser(eq("u2@test.local"), eq("/queue/reactions"), any());
    }

    @Test
    @DisplayName("Reaksiyon kaydi geri alinirsa WS yayini yapilmaz")
    void reactionRollback_noBroadcast() {
        stubReactionTarget();
        TransactionSynchronizationManager.initSynchronization();

        service.toggleReaction(CONV, 5L, CANDIDATE, "heart");
        TransactionSynchronizationManager.getSynchronizations()
                .forEach(s -> s.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));

        verifyNoInteractions(ws);
    }

    // ── Arama daveti yalniz Jitsi ────────────────────────────────────

    @Test
    @DisplayName("Jitsi davetleri kabul edilir (sesli arama #config parcasi dahil)")
    void jitsiInviteAccepted() {
        service.sendMessage(CONV, CANDIDATE, text("[CALL:video]https://meet.jit.si/kadrom-10-abc123xy"));
        service.sendMessage(CONV, CANDIDATE,
                text("[CALL:audio]https://meet.jit.si/kadrom-10-abc123xy#config.startWithVideoMuted=true"));
        verify(messages, times(2)).save(any());
    }

    @Test
    @DisplayName("[CALL: onekli Jitsi disi adres 422 ile reddedilir, kaydedilmez")
    void nonJitsiInviteRejected() {
        for (String bad : java.util.List.of(
                "[CALL:video]https://evil.example/login",
                "[CALL:video]http://meet.jit.si/oda",
                "[CALL:video]https://meet.jit.si.evil.example/oda",
                "[CALL:video]https://meet.jit.si@evil.example/oda",
                "[CALL:video]javascript:alert(1)",
                "[CALL:screen]https://meet.jit.si/oda",
                "[CALL:audio]https://meet.jit.si/oda/../../x")) {
            org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.sendMessage(CONV, CANDIDATE, text(bad)))
                    .as(bad)
                    .isInstanceOf(com.hotelapp.exception.BusinessRuleException.class)
                    .extracting(e -> ((com.hotelapp.exception.BusinessRuleException) e).getMessageKey())
                    .isEqualTo("error.message.callInviteInvalid");
        }
        verify(messages, never()).save(any());
        // Onek tasimayan duz metin (adres icerse de) serbest
        service.sendMessage(CONV, CANDIDATE, text("Toplanti linki: https://example.com [CALL:"));
        verify(messages).save(any());
    }
}
