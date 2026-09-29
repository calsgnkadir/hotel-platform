package com.hotelapp.integration;

import com.hotelapp.entity.*;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.*;
import com.hotelapp.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.data.domain.PageRequest;
import java.time.LocalDateTime;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class PrivateChatAndPhoneTest {
    @Autowired UserRepository users;
    @Autowired ConversationRepository conversations;
    @Autowired MessageRepository messages;
    @Autowired MessageService service;
    @Autowired PhoneVerificationService phones;

    private User user(Role role) {
        return users.save(User.builder().email(UUID.randomUUID()+"@test.com")
                .fullName("Private chat test").role(role).build());
    }

    // No enclosing test transaction: assertions read actual committed attempts.
    @Test void incorrectCodesPersistAndLockOutEvenTheCorrectCode() {
        User u = user(Role.CANDIDATE);
        u.setPhoneOtpCode("123456");
        u.setPhoneOtpExpiresAt(LocalDateTime.now().plusMinutes(5));
        users.save(u);
        for (int attempt=1; attempt<=5; attempt++) {
            assertThatThrownBy(() -> phones.verify(u.getId(), "000000"))
                    .isInstanceOf(BusinessRuleException.class);
            assertThat(users.findById(u.getId()).orElseThrow().getPhoneOtpAttempts()).isEqualTo(attempt);
        }
        assertThatThrownBy(() -> phones.verify(u.getId(), "123456"))
                .hasMessageContaining("Çok fazla");
        assertThat(users.findById(u.getId()).orElseThrow().isPhoneVerified()).isFalse();
    }

    @Test void onlyConversationMembersCanResolveAnAttachmentAndDtosHideStorageReferences() {
        User a=user(Role.CANDIDATE), b=user(Role.BUSINESS_OWNER), outsider=user(Role.CANDIDATE);
        Conversation c=conversations.save(Conversation.builder().candidate(a).businessOwner(b).build());
        Message m=messages.save(Message.builder().conversation(c).sender(a)
                .attachmentUrl("authenticated:raw:kadrom/messages/"+c.getId()+"/test.pdf")
                .attachmentName("test.pdf").attachmentType("file").build());
        assertThat(service.getAttachmentForUser(c.getId(),m.getId(),a.getId()).getId()).isEqualTo(m.getId());
        assertThat(service.getAttachmentForUser(c.getId(),m.getId(),b.getId()).getId()).isEqualTo(m.getId());
        assertThatThrownBy(() -> service.getAttachmentForUser(c.getId(),m.getId(),outsider.getId()))
                .isInstanceOf(com.hotelapp.exception.UnauthorizedException.class);
        Conversation other=conversations.save(Conversation.builder().candidate(outsider).businessOwner(b).build());
        assertThatThrownBy(() -> service.getAttachmentForUser(other.getId(),m.getId(),b.getId()))
                .isInstanceOf(com.hotelapp.exception.ResourceNotFoundException.class);
        String url=service.getMessages(c.getId(),a.getId(),PageRequest.of(0,10)).content().get(0).getAttachmentUrl();
        assertThat(url).isEqualTo("/api/messages/conversations/"+c.getId()+"/messages/"+m.getId()+"/attachment");
    }
}
