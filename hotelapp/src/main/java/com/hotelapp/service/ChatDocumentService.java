package com.hotelapp.service;

import com.hotelapp.dto.MessageDto;
import com.hotelapp.dto.MessageRequest;
import com.hotelapp.entity.Application;
import com.hotelapp.entity.Conversation;
import com.hotelapp.entity.Document;
import com.hotelapp.entity.DocumentRequest;
import com.hotelapp.enums.DocumentRequestStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.ConversationRepository;
import com.hotelapp.repository.DocumentRepository;
import com.hotelapp.repository.DocumentRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Belgeyi sohbetten gönder.
 *
 * İşletme belgeyi (adli sicil, hijyen raporu...) sohbette normal mesajla ister;
 * aday yüklü belgesini sohbetten tek tıkla gönderir. Ayrı "talep → onay"
 * adımı yok. Paylaşım, mevcut izin modelini kullanır: ilgili başvuruda o belge
 * tipi için DocumentRequest GRANTED olur; işletme belgeyi yine
 * /api/documents/{id}/url ile açar ve erişim kontrolü (hasGrantedAccess) orada
 * aynen yapılır.
 *
 * Mesaj içerik token'ı (frontend kart olarak çizer): [DOC_SHARED:42:CRIMINAL_RECORD]
 */
@Service
@RequiredArgsConstructor
public class ChatDocumentService {

    private final ConversationRepository conversationRepository;
    private final ApplicationRepository applicationRepository;
    private final DocumentRepository documentRepository;
    private final DocumentRequestRepository documentRequestRepository;
    private final MessageService messageService;

    @Transactional
    public MessageDto shareInChat(Long conversationId, Long candidateId, Long documentId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new ResourceNotFoundException("Sohbet", conversationId));
        if (!conv.getCandidate().getId().equals(candidateId)) {
            throw new UnauthorizedException("Bu sohbette belge gönderemezsin");
        }
        Document doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Belge", documentId));
        if (!doc.getStudent().getId().equals(candidateId)) {
            throw new UnauthorizedException("Bu belge senin değil");
        }
        Application app = resolveApplication(conv);

        DocumentRequest dr = documentRequestRepository
                .findByApplicationIdAndDocumentType(app.getId(), doc.getType())
                .orElseGet(() -> DocumentRequest.builder().application(app).documentType(doc.getType()).build());
        dr.setStatus(DocumentRequestStatus.GRANTED);
        dr.setRespondedAt(LocalDateTime.now());
        documentRequestRepository.save(dr);

        return post(conversationId, candidateId,
                "[DOC_SHARED:" + doc.getId() + ":" + doc.getType().name() + "]");
    }

    /** İzin başvuruya bağlı: sohbetin başvurusu, yoksa bu çiftin en son başvurusu. */
    private Application resolveApplication(Conversation conv) {
        if (conv.getApplication() != null) return conv.getApplication();
        return applicationRepository
                .findFirstByCandidateIdAndJobListing_Business_OwnerIdOrderByCreatedAtDesc(
                        conv.getCandidate().getId(), conv.getBusinessOwner().getId())
                .orElseThrow(() -> new BusinessRuleException(
                        "Belge paylaşımı yalnızca ilana başvurmuş bir adayla yapılabilir"));
    }

    private MessageDto post(Long conversationId, Long senderId, String content) {
        MessageRequest req = new MessageRequest();
        req.setContent(content);
        return messageService.sendMessage(conversationId, senderId, req);
    }
}
