package com.hotelapp.service;

import com.hotelapp.dto.MessageRequest;
import com.hotelapp.dto.StartConversationRequest;
import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.Message;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessBlockRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.CandidateBlockRepository;
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
    private CandidateBlockRepository candidateBlocks;
    private ApplicationRepository applications;
    private BusinessRepository businesses;
    private MessageReactionRepository reactions;
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
        u.setEnabled(true);
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
        applications = mock(ApplicationRepository.class);
        candidateBlocks = mock(CandidateBlockRepository.class);
        businesses = mock(BusinessRepository.class);
        reactions = mock(MessageReactionRepository.class);
        service = new MessageService(conversations, messages, reactions, users,
                applications, notifications, storage, mock(SimpMessagingTemplate.class), blocks,
                candidateBlocks, businesses);

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
    void unverifiedUserCannotStartConversation_butCanStillWriteExisting() {
        service.setEmailVerificationPolicy(new EmailVerificationPolicy(true));
        blocked(false);
        for (long initiator : new long[]{CANDIDATE, OWNER}) {
            long other = initiator == CANDIDATE ? OWNER : CANDIDATE;
            assertThatThrownBy(() -> service.startConversation(initiator, startWith(other)))
                    .isInstanceOf(com.hotelapp.exception.EmailNotVerifiedException.class)
                    .hasMessage("Devam etmek için e-posta adresini doğrula.");
        }
        verify(conversations, never()).save(any());
        // Mevcut sohbette mesaj yazmak kapsam dışı (kapı yalnız başlatmada)
        assertThat(service.sendMessage(CONV, CANDIDATE, text("merhaba")).getContent()).isEqualTo("merhaba");

        candidate.setEmailVerifiedAt(LocalDateTime.now());
        assertThat(service.startConversation(CANDIDATE, startWith(OWNER)).getId()).isEqualTo(CONV);
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

    // ---- Yeni sohbet icin basvuru iliskisi ----

    private void noExistingConversation() {
        when(conversations.findByCandidateIdAndBusinessOwnerId(CANDIDATE, OWNER)).thenReturn(Optional.empty());
    }

    private void applied(boolean value) {
        when(applications.existsByCandidateIdAndJobListingBusinessOwnerId(CANDIDATE, OWNER)).thenReturn(value);
    }

    @Test
    void businessCannotOpenNewConversationWithCandidateWhoNeverApplied() {
        blocked(false);
        noExistingConversation();
        applied(false);
        assertThatThrownBy(() -> service.startConversation(OWNER, startWith(CANDIDATE)))
                .isInstanceOf(BusinessRuleException.class);
        verify(conversations, never()).save(any());
    }

    @Test
    void businessCanOpenNewConversationWithApplicant() {
        blocked(false);
        noExistingConversation();
        applied(true);
        service.startConversation(OWNER, startWith(CANDIDATE));
        verify(conversations).save(argThat(c ->
                c.getCandidate() == candidate && c.getBusinessOwner() == owner));
    }

    @Test
    void blockStillAppliesToRelatedPairForNewConversation() {
        blocked(true);
        noExistingConversation();
        applied(true);
        assertThatThrownBy(() -> service.startConversation(OWNER, startWith(CANDIDATE)))
                .isInstanceOf(UnauthorizedException.class);
        verify(conversations, never()).save(any());
    }

    @Test
    void unrelatedTargetGetsUniformErrorEvenIfBlocked() {
        // Iliskisiz hedefte engel durumu ifsa edilmez: ayni tek tip 422
        blocked(true);
        noExistingConversation();
        applied(false);
        assertThatThrownBy(() -> service.startConversation(OWNER, startWith(CANDIDATE)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageStartingWith("Bu kişiyle sohbet başlatılamaz");
        verify(conversations, never()).save(any());
    }

    @Test
    void unknownWrongRoleAndDisabledTargetsGetSameErrorAsUnrelated() {
        when(users.findById(777L)).thenReturn(Optional.empty());
        User otherCandidate = user(778L, Role.CANDIDATE);
        when(users.findById(778L)).thenReturn(Optional.of(otherCandidate));
        User disabledOwner = user(779L, Role.BUSINESS_OWNER);
        disabledOwner.setEnabled(false);
        when(users.findById(779L)).thenReturn(Optional.of(disabledOwner));

        String expected = "Bu kişiyle sohbet başlatılamaz";
        assertThatThrownBy(() -> service.startConversation(CANDIDATE, startWith(777L)))
                .isInstanceOf(BusinessRuleException.class).hasMessageStartingWith(expected);
        assertThatThrownBy(() -> service.startConversation(CANDIDATE, startWith(778L)))
                .isInstanceOf(BusinessRuleException.class).hasMessageStartingWith(expected);
        assertThatThrownBy(() -> service.startConversation(CANDIDATE, startWith(779L)))
                .isInstanceOf(BusinessRuleException.class).hasMessageStartingWith(expected);
        verify(conversations, never()).save(any());
    }

    @Test
    void existingConversationStillReturnedWithoutRelation() {
        blocked(false);
        applied(false);
        assertThat(service.startConversation(OWNER, startWith(CANDIDATE)).getId()).isEqualTo(CONV);
        verify(conversations, never()).save(any());
    }

    @Test
    void candidateCannotOpenNewConversationWithoutApplication() {
        noExistingConversation();
        applied(false);
        assertThatThrownBy(() -> service.startConversation(CANDIDATE, startWith(OWNER)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageStartingWith("Bu kişiyle sohbet başlatılamaz");
        verify(conversations, never()).save(any());
    }

    @Test
    void candidateCanOpenNewConversationWithBusinessItAppliedTo() {
        noExistingConversation();
        applied(true);
        service.startConversation(CANDIDATE, startWith(OWNER));
        verify(conversations).save(argThat(c ->
                c.getCandidate() == candidate && c.getBusinessOwner() == owner));
    }

    @Test
    void conversationDtoCarriesOtherPartyBusinessIdOnlyForBusinessSide() {
        com.hotelapp.entity.Business biz = new com.hotelapp.entity.Business();
        biz.setId(500L);
        when(businesses.findByOwnerId(OWNER)).thenReturn(Optional.of(biz));

        assertThat(service.startConversation(CANDIDATE, startWith(OWNER)).getOtherPartyBusinessId())
                .isEqualTo(500L);
        assertThat(service.startConversation(OWNER, startWith(CANDIDATE)).getOtherPartyBusinessId())
                .isNull();
    }

    // ---- Reaksiyon: engel kurali ----

    private void messageInConv() {
        Message m = Message.builder().id(99L).conversation(conv).sender(candidate).content("x").build();
        when(messages.findById(99L)).thenReturn(Optional.of(m));
    }

    @Test
    void blockedBusinessCannotReact() {
        blocked(true);
        messageInConv();
        assertThatThrownBy(() -> service.toggleReaction(CONV, 99L, OWNER, "heart"))
                .isInstanceOf(UnauthorizedException.class);
        verify(reactions, never()).save(any());
    }

    @Test
    void candidateBlockedByBusinessCannotReact() {
        businessBlocked(true);
        messageInConv();
        assertThatThrownBy(() -> service.toggleReaction(CONV, 99L, CANDIDATE, "heart"))
                .isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> service.toggleReaction(CONV, 99L, OWNER, "heart"))
                .isInstanceOf(BusinessRuleException.class);
        verify(reactions, never()).save(any());
    }

    @Test
    void unblockedPartiesCanReact() {
        messageInConv();
        when(reactions.findByMessageIdAndUserId(99L, OWNER)).thenReturn(Optional.empty());
        service.toggleReaction(CONV, 99L, OWNER, "heart");
        verify(reactions).save(any());
    }

    // ---- Isletme adayi engelledi ----

    private void businessBlocked(boolean value) {
        when(candidateBlocks.existsByBusinessOwnerIdAndCandidateId(OWNER, CANDIDATE)).thenReturn(value);
    }

    @Test
    void candidateBlockedByBusinessCannotStartConversation() {
        businessBlocked(true);
        assertThatThrownBy(() -> service.startConversation(CANDIDATE, startWith(OWNER)))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Bu kişiyle şu anda mesajlaşılamıyor.");
        noExistingConversation();
        applied(true);
        assertThatThrownBy(() -> service.startConversation(CANDIDATE, startWith(OWNER)))
                .isInstanceOf(UnauthorizedException.class);
        verify(conversations, never()).save(any());
    }

    @Test
    void candidateBlockedByBusinessCannotSendMessageOrAttachment() {
        businessBlocked(true);
        assertThatThrownBy(() -> service.sendMessage(CONV, CANDIDATE, text("merhaba")))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Bu kişiyle şu anda mesajlaşılamıyor.");
        assertThatThrownBy(() -> service.sendAttachment(CONV, CANDIDATE,
                new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[]{1}), null))
                .isInstanceOf(UnauthorizedException.class);
        verify(messages, never()).save(any());
        verify(notifications, never()).notify(anyLong(), any(), any(), any(), any());
        verifyNoInteractions(storage);
    }

    @Test
    void businessCannotWriteToCandidateItBlocked() {
        businessBlocked(true);
        assertThatThrownBy(() -> service.startConversation(OWNER, startWith(CANDIDATE)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessage("Önce engeli kaldır.");
        assertThatThrownBy(() -> service.sendMessage(CONV, OWNER, text("merhaba")))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessage("Önce engeli kaldır.");
        assertThatThrownBy(() -> service.sendAttachment(CONV, OWNER,
                new MockMultipartFile("file", "a.pdf", "application/pdf", new byte[]{1}), null))
                .isInstanceOf(BusinessRuleException.class);
        verify(messages, never()).save(any());
        verifyNoInteractions(storage);
    }

    @Test
    void withoutBusinessBlockBothSidesCanWrite() {
        businessBlocked(false);
        assertThat(service.sendMessage(CONV, CANDIDATE, text("tekrar merhaba")).getContent())
                .isEqualTo("tekrar merhaba");
        assertThat(service.sendMessage(CONV, OWNER, text("selam")).getContent()).isEqualTo("selam");
    }
}
