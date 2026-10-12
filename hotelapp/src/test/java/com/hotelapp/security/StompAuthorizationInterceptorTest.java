package com.hotelapp.security;

import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.ConversationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** STOMP yetkisi: CONNECT kimlik + hesap durumu, SUBSCRIBE hedef yetkisi, SEND yalniz /app/**. */
class StompAuthorizationInterceptorTest {

    private JwtService jwt;
    private UserDetailsService uds;
    private ConversationRepository conversations;
    private StompAuthorizationInterceptor interceptor;
    private final MessageChannel channel = mock(MessageChannel.class);

    private User candidate;
    private User owner;

    private static User user(long id, Role role, String email) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        u.setEmail(email);
        u.setEnabled(true);
        return u;
    }

    @BeforeEach
    void setUp() {
        jwt = mock(JwtService.class);
        uds = mock(UserDetailsService.class);
        conversations = mock(ConversationRepository.class);
        interceptor = new StompAuthorizationInterceptor(jwt, uds, conversations);
        candidate = user(1L, Role.CANDIDATE, "aday@test.local");
        owner = user(2L, Role.BUSINESS_OWNER, "isletme@test.local");
        Conversation c = Conversation.builder().id(10L).candidate(candidate).businessOwner(owner).build();
        when(conversations.findById(10L)).thenReturn(Optional.of(c));
    }

    private Message<byte[]> frame(StompCommand cmd, String dest, String auth, User asUser) {
        StompHeaderAccessor a = StompHeaderAccessor.create(cmd);
        if (dest != null) a.setDestination(dest);
        if (auth != null) a.addNativeHeader("Authorization", auth);
        if (asUser != null) {
            UserPrincipal p = new UserPrincipal(asUser);
            a.setUser(new UsernamePasswordAuthenticationToken(p, null, p.getAuthorities()));
        }
        a.setSessionId("s1");
        a.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], a.getMessageHeaders());
    }

    private void tokenFor(User u) {
        when(jwt.extractUsername("tok")).thenReturn(u.getEmail());
        when(uds.loadUserByUsername(u.getEmail())).thenReturn(new UserPrincipal(u));
        when(jwt.isTokenValid(eq("tok"), any())).thenReturn(true);
    }

    // ---- CONNECT ----

    @Test
    @DisplayName("CONNECT: gecerli token -> kullanici oturuma baglanir")
    void connect_validToken_setsUser() {
        tokenFor(candidate);
        Message<?> out = interceptor.preSend(frame(StompCommand.CONNECT, null, "Bearer tok", null), channel);
        StompHeaderAccessor acc = StompHeaderAccessor.wrap(out);
        assertThat(acc.getUser()).isNotNull();
        assertThat(acc.getUser().getName()).isEqualTo("aday@test.local");
    }

    @Test
    @DisplayName("CONNECT: token yok -> reddedilir")
    void connect_noToken_rejected() {
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.CONNECT, null, null, null), channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("CONNECT: gecersiz token -> reddedilir")
    void connect_invalidToken_rejected() {
        when(jwt.extractUsername("tok")).thenThrow(new RuntimeException("bozuk"));
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.CONNECT, null, "Bearer tok", null), channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("CONNECT: banli kullanici -> reddedilir")
    void connect_bannedUser_rejected() {
        candidate.setBannedUntil(LocalDateTime.now().plusDays(1));
        tokenFor(candidate);
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.CONNECT, null, "Bearer tok", null), channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("CONNECT: devre disi (silme talebi) kullanici -> reddedilir")
    void connect_disabledUser_rejected() {
        candidate.setEnabled(false);
        tokenFor(candidate);
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.CONNECT, null, "Bearer tok", null), channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ---- SUBSCRIBE ----

    @Test
    @DisplayName("SUBSCRIBE: /user/queue/** ve /topic/pulse serbest")
    void subscribe_userQueue_allowed() {
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/user/queue/messages", null, candidate), channel)).isNotNull();
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/user/queue/presence", null, candidate), channel)).isNotNull();
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/pulse", null, candidate), channel)).isNotNull();
    }

    @Test
    @DisplayName("SUBSCRIBE: typing topic'i yalniz sohbet uyesine acik")
    void subscribe_typing_onlyMembers() {
        User stranger = user(3L, Role.CANDIDATE, "yabanci@test.local");
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/typing.10", null, candidate), channel)).isNotNull();
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/typing.10", null, owner), channel)).isNotNull();
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/typing.10", null, stranger), channel)).isNull();
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/typing.999", null, candidate), channel)).isNull();
    }

    @Test
    @DisplayName("SUBSCRIBE: /topic/presence, dogrudan /queue/** ve bilinmeyen topic dusurulur")
    void subscribe_otherDestinations_dropped() {
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/presence", null, candidate), channel)).isNull();
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/queue/messages-users1", null, candidate), channel)).isNull();
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/anything", null, candidate), channel)).isNull();
        assertThat(interceptor.preSend(frame(StompCommand.SUBSCRIBE, "/topic/typing.10", null, null), channel)).isNull();
    }

    // ---- SEND ----

    @Test
    @DisplayName("SEND: yalniz /app/**; broker hedeflerine dogrudan yayin engellenir")
    void send_onlyAppPrefix() {
        assertThat(interceptor.preSend(frame(StompCommand.SEND, "/app/chat.typing/10", null, candidate), channel)).isNotNull();
        assertThat(interceptor.preSend(frame(StompCommand.SEND, "/topic/typing.10", null, candidate), channel)).isNull();
        assertThat(interceptor.preSend(frame(StompCommand.SEND, "/topic/presence", null, candidate), channel)).isNull();
        assertThat(interceptor.preSend(frame(StompCommand.SEND, "/queue/messages-users1", null, candidate), channel)).isNull();
        assertThat(interceptor.preSend(frame(StompCommand.SEND, "/app/chat.typing/10", null, null), channel)).isNull();
    }
}
