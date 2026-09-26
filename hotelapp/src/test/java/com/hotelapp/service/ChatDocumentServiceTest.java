package com.hotelapp.service;

import com.hotelapp.dto.MessageRequest;
import com.hotelapp.entity.Application;
import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.Document;
import com.hotelapp.entity.DocumentRequest;
import com.hotelapp.entity.User;
import com.hotelapp.enums.DocumentRequestStatus;
import com.hotelapp.enums.DocumentType;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.ConversationRepository;
import com.hotelapp.repository.DocumentRepository;
import com.hotelapp.repository.DocumentRequestRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatDocumentServiceTest {

    @Mock private ConversationRepository conversationRepository;
    @Mock private ApplicationRepository applicationRepository;
    @Mock private DocumentRepository documentRepository;
    @Mock private DocumentRequestRepository documentRequestRepository;
    @Mock private MessageService messageService;

    @InjectMocks private ChatDocumentService service;

    private static final Long CONV = 5L, CAND = 1L, OWNER = 2L, APP = 9L, DOC = 42L;

    private Conversation conv(boolean withApplication) {
        Application app = Application.builder().id(APP).build();
        return Conversation.builder()
                .id(CONV)
                .candidate(User.builder().id(CAND).build())
                .businessOwner(User.builder().id(OWNER).build())
                .application(withApplication ? app : null)
                .build();
    }

    private String sentContent(Long senderId) {
        ArgumentCaptor<MessageRequest> req = ArgumentCaptor.forClass(MessageRequest.class);
        verify(messageService).sendMessage(eq(CONV), eq(senderId), req.capture());
        return req.getValue().getContent();
    }

    @Test
    void owner_requests_document_creates_pending_request_and_posts_card() {
        when(conversationRepository.findById(CONV)).thenReturn(Optional.of(conv(true)));
        when(documentRequestRepository.findByApplicationIdAndDocumentType(APP, DocumentType.CRIMINAL_RECORD))
                .thenReturn(Optional.empty());

        service.requestInChat(CONV, OWNER, DocumentType.CRIMINAL_RECORD);

        ArgumentCaptor<DocumentRequest> saved = ArgumentCaptor.forClass(DocumentRequest.class);
        verify(documentRequestRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(DocumentRequestStatus.PENDING);
        assertThat(sentContent(OWNER)).isEqualTo("[DOC_REQUEST:CRIMINAL_RECORD]");
    }

    @Test
    void re_request_keeps_existing_grant() {
        when(conversationRepository.findById(CONV)).thenReturn(Optional.of(conv(true)));
        DocumentRequest granted = DocumentRequest.builder()
                .documentType(DocumentType.HEALTH_CERTIFICATE).status(DocumentRequestStatus.GRANTED).build();
        when(documentRequestRepository.findByApplicationIdAndDocumentType(APP, DocumentType.HEALTH_CERTIFICATE))
                .thenReturn(Optional.of(granted));

        service.requestInChat(CONV, OWNER, DocumentType.HEALTH_CERTIFICATE);

        assertThat(granted.getStatus()).isEqualTo(DocumentRequestStatus.GRANTED);
    }

    @Test
    void candidate_cannot_request_documents() {
        when(conversationRepository.findById(CONV)).thenReturn(Optional.of(conv(true)));

        assertThatThrownBy(() -> service.requestInChat(CONV, CAND, DocumentType.CRIMINAL_RECORD))
                .isInstanceOf(UnauthorizedException.class);
        verify(documentRequestRepository, never()).save(any());
    }

    @Test
    void candidate_shares_own_document_grants_access_and_posts_card() {
        when(conversationRepository.findById(CONV)).thenReturn(Optional.of(conv(false)));
        when(applicationRepository.findFirstByCandidateIdAndJobListing_Business_OwnerIdOrderByCreatedAtDesc(CAND, OWNER))
                .thenReturn(Optional.of(Application.builder().id(APP).build()));
        when(documentRepository.findById(DOC)).thenReturn(Optional.of(Document.builder()
                .id(DOC).type(DocumentType.CRIMINAL_RECORD).student(User.builder().id(CAND).build()).build()));
        when(documentRequestRepository.findByApplicationIdAndDocumentType(APP, DocumentType.CRIMINAL_RECORD))
                .thenReturn(Optional.empty());

        service.shareInChat(CONV, CAND, DOC);

        ArgumentCaptor<DocumentRequest> saved = ArgumentCaptor.forClass(DocumentRequest.class);
        verify(documentRequestRepository).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(DocumentRequestStatus.GRANTED);
        assertThat(saved.getValue().getRespondedAt()).isNotNull();
        assertThat(sentContent(CAND)).isEqualTo("[DOC_SHARED:42:CRIMINAL_RECORD]");
    }

    @Test
    void cannot_share_someone_elses_document() {
        when(conversationRepository.findById(CONV)).thenReturn(Optional.of(conv(true)));
        when(documentRepository.findById(DOC)).thenReturn(Optional.of(Document.builder()
                .id(DOC).type(DocumentType.CRIMINAL_RECORD).student(User.builder().id(99L).build()).build()));

        assertThatThrownBy(() -> service.shareInChat(CONV, CAND, DOC))
                .isInstanceOf(UnauthorizedException.class);
        verify(documentRequestRepository, never()).save(any());
    }

    @Test
    void owner_cannot_share_as_candidate() {
        when(conversationRepository.findById(CONV)).thenReturn(Optional.of(conv(true)));

        assertThatThrownBy(() -> service.shareInChat(CONV, OWNER, DOC))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void no_application_between_parties_is_rejected() {
        when(conversationRepository.findById(CONV)).thenReturn(Optional.of(conv(false)));
        when(applicationRepository.findFirstByCandidateIdAndJobListing_Business_OwnerIdOrderByCreatedAtDesc(anyLong(), anyLong()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.requestInChat(CONV, OWNER, DocumentType.CRIMINAL_RECORD))
                .isInstanceOf(BusinessRuleException.class);
        verify(messageService, never()).sendMessage(anyLong(), anyLong(), any());
    }

    @Test
    void notification_preview_is_readable() {
        assertThat(MessageService.readablePreview("[DOC_REQUEST:CRIMINAL_RECORD]"))
                .isEqualTo("Belge istedi: Adli sicil kaydı");
        assertThat(MessageService.readablePreview("[DOC_SHARED:42:HEALTH_CERTIFICATE]"))
                .isEqualTo("Belge gönderdi: Hijyen / sağlık belgesi");
        assertThat(MessageService.readablePreview("Merhaba")).isEqualTo("Merhaba");
    }
}
