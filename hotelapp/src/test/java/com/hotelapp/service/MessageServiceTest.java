package com.hotelapp.service;

import com.hotelapp.dto.MessageRequest;
import com.hotelapp.dto.StartConversationRequest;
import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.Message;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessBlockRepository;
import com.hotelapp.repository.ConversationRepository;
import com.hotelapp.repository.MessageReactionRepository;
import com.hotelapp.repository.MessageRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.mock.web.MockMultipartFile;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Aday bir isletmeyi engellediyse o isletme adayla sohbet baslatamaz ve
 * mesaj/dosya gonderemez. Aday tarafi ve engellenmemis isletme etkilenmez.
 */
class MessageServiceTest {

    private static final long CANDIDATE = 1L;
    private static final long OWNER = 2L;
    private static final long CONV = 10L;

    private ConversationRepository conversations;
    private MessageRepository messages;
    private UserRepository users;
    private NotificationService notifications;
    private FileStorageService storage;
    private BusinessBlockRepository blocks;
    private MessageService service;
    private User candidate;
    private User owner;
    private Conversation conv;

    private static User user(long id, Role role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        u.setFullName("Kullanici " + id);
        u.setEmail("u" + id + "@test.local");
        return u;
    }

    @BeforeEach
    void setUp() {
        conversations = mock(ConversationRepository.class);
        messages = mock(MessageRepository.class);
        users = mock(UserRepository.class);
        notifications = mock(NotificationService.class);
        storage = mock(FileStorageService.class);
        blocks = mock(BusinessBlockRepository.class);
        service = new MessageService(conversations, messages, mock(MessageReactionRepository.class), users,
                mock(ApplicationRepository.class), notifications, storage, mock(SimpMessagingTemplate.class), blocks);

        candidate = user(CANDIDATE, Role.CANDIDATE);
        owner = user(OWNER, Role.BUSINESS_OWNER);
        conv = Conversation.builder().id(CONV).candidate(candidate).businessOwner(owner).build();
        when(users.findById(CANDIDATE)).thenReturn(Optional.of(candidate));
        when(users.findById(OWNER)).thenReturn(Optional.of(owner));
        when(conversations.findById(CONV)).thenReturn(Optional.of(conv));
        when(conversations.findByCandidateIdAndBusinessOwnerId(CANDIDATE, OWNER)).thenReturn(Optional.of(conv));
        when(conversations.save(any())).thenAnswer(i -> i.getArgument(0));
        when(messages.save(any())).thenAnswer(i -> {
            Message m = i.getArgument(0);
            m.setId(99L);
            m.setSentAt(LocalDateTime.now());
            return m;
        });
    }

    private void blocked(boolean value) {
        when(blocks.existsByUserIdAndBusinessOwnerId(CANDIDATE, OWNER)).thenReturn(value);
    }

    private static StartConversationRequest startWith(long otherId) {
        StartConversationRequest r = new StartConversationRequest();
        r.setOtherPartyId(otherId);
        return r;
    }

    private static MessageRequest text(String content) {
        MessageRequest r = new MessageRequest();
        r.setContent(content);
        return r;
    }

    @Test
    void blockedBusinessCannotStartConversation() {
        blocked(true);
        assertThatThrownBy(() -> service.startConversation(OWNER, startWith(CANDIDATE)))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void blockedBusinessCannotSendMessageOrAttachment() {
        blocked(true);
        assertThatThrownBy(() -> service.sendMessage(CONV, OWNER, text("merhaba")))
                .isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> service.sendAttachment(CONV, OWNER,
                new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[]{1}), null))
                .isInstanceOf(UnauthorizedException.class);
        verify(messages, never()).save(any());
        verify(notifications, never()).notify(anyLong(), any(), any(), any(), any());
        verifyNoInteractions(storage);
    }

    @Test
    void candidateWhoBlockedCanStillWrite() {
        blocked(true);
        assertThat(service.startConversation(CANDIDATE, startWith(OWNER)).getId()).isEqualTo(CONV);
        assertThat(service.sendMessage(CONV, CANDIDATE, text("merhaba")).getContent()).isEqualTo("merhaba");
    }

    @Test
    void notBlockedBusinessWorksNormally() {
        blocked(false);
        assertThat(service.startConversation(OWNER, startWith(CANDIDATE)).getId()).isEqualTo(CONV);
        assertThat(service.sendMessage(CONV, OWNER, text("merhaba")).getContent()).isEqualTo("merhaba");
        verify(messages).save(any());
    }
}
