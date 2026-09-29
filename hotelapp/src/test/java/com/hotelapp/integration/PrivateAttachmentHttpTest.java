package com.hotelapp.integration;

import com.hotelapp.entity.*;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.*;
import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.FileStorageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PrivateAttachmentHttpTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired ConversationRepository conversations;
    @Autowired MessageRepository messages;
    @MockBean FileStorageService storage;
    private User create(Role role) {
        return users.save(User.builder().email(UUID.randomUUID()+"@test.com").fullName("Test").role(role).build());
    }
    @Test void downloadRequiresMembershipAndNeverRedirectsToStorage() throws Exception {
        User a=create(Role.CANDIDATE), b=create(Role.BUSINESS_OWNER), stranger=create(Role.CANDIDATE);
        Conversation c=conversations.save(Conversation.builder().candidate(a).businessOwner(b).build());
        String ref="authenticated:raw:kadrom/messages/"+c.getId()+"/belge.pdf";
        Message m=messages.save(Message.builder().conversation(c).sender(a).attachmentUrl(ref)
                .attachmentName("belge.pdf").attachmentType("file").build());
        String path="/api/messages/conversations/"+c.getId()+"/messages/"+m.getId()+"/attachment";
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path).with(user(new UserPrincipal(stranger)))).andExpect(status().isForbidden());
        verifyNoInteractions(storage);
        when(storage.readPrivateAttachment(ref)).thenReturn("%PDF-test".getBytes());
        for (User member : new User[]{a,b}) {
            mvc.perform(get(path).with(user(new UserPrincipal(member))))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control","no-store, private"))
                    .andExpect(header().doesNotExist("Location"))
                    .andExpect(content().bytes("%PDF-test".getBytes()));
        }
    }
    @Test void profileDocumentUploadIsRetired() throws Exception {
        User a=create(Role.CANDIDATE);
        mvc.perform(multipart("/api/documents/upload")
                .file("file","%PDF-test".getBytes()).param("type","CRIMINAL_RECORD")
                .with(user(new UserPrincipal(a))))
                .andExpect(status().isGone());
        verifyNoInteractions(storage);
    }
}
