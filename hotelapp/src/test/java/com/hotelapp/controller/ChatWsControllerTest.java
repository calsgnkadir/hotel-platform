package com.hotelapp.controller;

import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.BusinessBlockRepository;
import com.hotelapp.repository.CandidateBlockRepository;
import com.hotelapp.repository.ConversationRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.security.Principal;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Yaziyor sinyali: yalniz uye + etkin + engelsiz taraflar arasinda yayinlanir. */
class ChatWsControllerTest {

    private ConversationRepository conversations;
    private UserRepository users;
    private SimpMessagingTemplate template;
    private CandidateBlockRepository candidateBlocks;
    private BusinessBlockRepository businessBlocks;
    private ChatWsController controller;
    private User candidate;
    private User owner;

    private static User user(long id, Role role, String email) {
        User u = new User();
        u.setId(id);
        u.setRole(role);
        u.setEmail(email);
        u.setFullName("U" + id);
        u.setEnabled(true);
        return u;
    }

    private static Principal as(User u) {
        return u::getEmail;
    }

    @BeforeEach
    void setUp() {
        conversations = mock(ConversationRepository.class);
        users = mock(UserRepository.class);
        template = mock(SimpMessagingTemplate.class);
        candidateBlocks = mock(CandidateBlockRepository.class);
        businessBlocks = mock(BusinessBlockRepository.class);
        controller = new ChatWsController(conversations, users, template, candidateBlocks, businessBlocks);
        candidate = user(1L, Role.CANDIDATE, "aday@test.local");
        owner = user(2L, Role.BUSINESS_OWNER, "isletme@test.local");
        when(users.findByEmail("aday@test.local")).thenReturn(Optional.of(candidate));
        when(users.findByEmail("isletme@test.local")).thenReturn(Optional.of(owner));
        when(conversations.findById(10L)).thenReturn(Optional.of(
                Conversation.builder().id(10L).candidate(candidate).businessOwner(owner).build()));
    }

    @Test
    @DisplayName("Engel yokken uye taraf yazinca yayinlanir")
    void member_noBlock_broadcasts() {
        controller.onTyping(10L, as(candidate));
        verify(template).convertAndSend(eq("/topic/typing.10"), any(Object.class));
    }

    @Test
    @DisplayName("Isletme adayi engellediyse yaziyor sinyali (iki yonde) yayinlanmaz")
    void businessBlockedCandidate_noBroadcast() {
        when(candidateBlocks.existsByBusinessOwnerIdAndCandidateId(2L, 1L)).thenReturn(true);
        controller.onTyping(10L, as(candidate));
        controller.onTyping(10L, as(owner));
        verify(template, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    @DisplayName("Aday isletmeyi engellediyse yaziyor sinyali yayinlanmaz")
    void candidateBlockedBusiness_noBroadcast() {
        when(businessBlocks.existsByUserIdAndBusinessOwnerId(1L, 2L)).thenReturn(true);
        controller.onTyping(10L, as(owner));
        verify(template, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    @DisplayName("Uye olmayan / devre disi gonderen yayinlanmaz")
    void nonMemberOrDisabled_noBroadcast() {
        User stranger = user(3L, Role.CANDIDATE, "yabanci@test.local");
        when(users.findByEmail("yabanci@test.local")).thenReturn(Optional.of(stranger));
        controller.onTyping(10L, as(stranger));
        candidate.setEnabled(false);
        controller.onTyping(10L, as(candidate));
        verify(template, never()).convertAndSend(anyString(), any(Object.class));
    }
}
