package com.hotelapp.service;

import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.BusinessBlockRepository;
import com.hotelapp.repository.CandidateBlockRepository;
import com.hotelapp.repository.ConversationRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.security.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Presence gizliligi: durum yalniz sohbet karsi taraflarina (engelsiz) gider;
 * /topic/presence'a genel yayin yapilmaz; REST sorgulari ayni kuralla suzulur.
 */
class PresenceServiceTest {

    private SimpMessagingTemplate template;
    private ConversationRepository conversations;
    private CandidateBlockRepository candidateBlocks;
    private BusinessBlockRepository businessBlocks;
    private PresenceService service;

    private User candidate;   // id 1
    private User owner;       // id 2 (sohbet karsi tarafi)
    private User stranger;    // id 3 (iliskisiz)

    private static User user(long id, Role role) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        u.setEmail("u" + id + "@test.local");
        u.setEnabled(true);
        return u;
    }

    @BeforeEach
    void setUp() {
        template = mock(SimpMessagingTemplate.class);
        conversations = mock(ConversationRepository.class);
        candidateBlocks = mock(CandidateBlockRepository.class);
        businessBlocks = mock(BusinessBlockRepository.class);
        service = new PresenceService(template, mock(UserRepository.class), conversations,
                candidateBlocks, businessBlocks);
        candidate = user(1, Role.CANDIDATE);
        owner = user(2, Role.BUSINESS_OWNER);
        stranger = user(3, Role.CANDIDATE);
        Conversation c = Conversation.builder().id(10L).candidate(candidate).businessOwner(owner).build();
        when(conversations.findAllForUser(1L)).thenReturn(List.of(c));
        when(conversations.findAllForUser(2L)).thenReturn(List.of(c));
        when(conversations.findAllForUser(3L)).thenReturn(List.of());
    }

    private Message<byte[]> msg(User u, String sessionId) {
        StompHeaderAccessor a = StompHeaderAccessor.create(StompCommand.CONNECTED);
        a.setSessionId(sessionId);
        UserPrincipal p = new UserPrincipal(u);
        a.setUser(new UsernamePasswordAuthenticationToken(p, null, p.getAuthorities()));
        return MessageBuilder.createMessage(new byte[0], a.getMessageHeaders());
    }

    private void connect(User u, String sid) {
        service.onConnect(new SessionConnectedEvent(this, msg(u, sid)));
    }

    private void disconnect(User u, String sid) {
        service.onDisconnect(new SessionDisconnectEvent(this, msg(u, sid), sid, CloseStatus.NORMAL));
    }

    @Test
    @DisplayName("Online olay yalniz cevrimici karsi tarafa /user/queue/presence ile gider; /topic/presence yok")
    void onlineEvent_goesOnlyToCounterpart() {
        connect(owner, "s-owner");
        connect(stranger, "s-stranger");
        connect(candidate, "s-cand");

        verify(template).convertAndSendToUser(eq("u2@test.local"), eq("/queue/presence"), any(Object.class));
        verify(template, never()).convertAndSendToUser(eq("u3@test.local"), anyString(), any(Object.class));
        verify(template, never()).convertAndSend(eq("/topic/presence"), any(Object.class));
    }

    @Test
    @DisplayName("REST: online listesi ve son gorulme yalniz karsi taraf icin")
    void restQueries_filteredByRelation() {
        connect(owner, "s-owner");
        connect(stranger, "s-stranger");

        assertThat(service.getOnlineUserIds(1L)).containsExactly(2L);
        assertThat(service.getOnlineUserIds(3L)).isEmpty();
        assertThat(service.canSee(3L, 2L)).isFalse();
        assertThat(service.canSee(1L, 2L)).isTrue();
        assertThat(service.onlineUserCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("Engel (iki yonden biri) varsa karsi taraf presence goremez")
    void blockedPair_hidden() {
        when(candidateBlocks.findCandidateIdsByBusinessOwnerId(2L)).thenReturn(Set.of(1L));
        when(candidateBlocks.findBusinessOwnerIdsByCandidateId(1L)).thenReturn(Set.of(2L));
        connect(owner, "s-owner");
        connect(candidate, "s-cand");

        assertThat(service.getOnlineUserIds(1L)).isEmpty();
        assertThat(service.getOnlineUserIds(2L)).isEmpty();
        verify(template, never()).convertAndSendToUser(anyString(), anyString(), any(Object.class));
    }

    @Test
    @DisplayName("Coklu sekme: son oturum kapaninca offline olayi + son gorulme")
    void multiTab_offlineOnlyAfterLastSession() {
        connect(owner, "s-owner");
        connect(candidate, "tab1");
        connect(candidate, "tab2");
        disconnect(candidate, "tab1");
        assertThat(service.isOnline(1L)).isTrue();
        disconnect(candidate, "tab2");
        assertThat(service.isOnline(1L)).isFalse();
        assertThat(service.getLastSeen(1L)).isNotNull();
        // online (1) + offline (1) olaylari karsi tarafa
        verify(template, org.mockito.Mockito.times(2))
                .convertAndSendToUser(eq("u2@test.local"), eq("/queue/presence"), any(Object.class));
    }
}
