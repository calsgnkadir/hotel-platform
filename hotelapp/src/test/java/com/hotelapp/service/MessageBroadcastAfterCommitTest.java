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
        MessageRepository messages = mock(MessageRepository.class);
        UserRepository users = mock(UserRepository.class);
        ws = mock(SimpMessagingTemplate.class);
        service = new MessageService(conversations, messages, mock(MessageReactionRepository.class), users,
                mock(ApplicationRepository.class), mock(NotificationService.class), mock(FileStorageService.class),
                ws, mock(BusinessBlockRepository.class), mock(CandidateBlockRepository.class),
                mock(BusinessRepository.class));

        User candidate = user(CANDIDATE, Role.CANDIDATE);
        User owner = user(OWNER, Role.BUSINESS_OWNER);
        Conversation conv = Conversation.builder().id(CONV).candidate(candidate).businessOwner(owner).build();
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
}
