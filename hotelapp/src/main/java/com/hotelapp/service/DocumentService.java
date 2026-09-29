package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Document;
import com.hotelapp.enums.DocumentType;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.DocumentRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final ApplicationRepository applicationRepository;
    private final FileStorageService fileStorageService;

    @Transactional
    public DocumentDto upload(Long candidateId, MultipartFile file, DocumentType type, LocalDate expiresAt) {
        throw new com.hotelapp.exception.BusinessRuleException("Profil belgesi yükleme kaldırıldı. Dosyayı sohbetten paylaşın.");
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> listMyDocuments(Long candidateId) {
        return documentRepository.findAllByStudentId(candidateId)
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public void deleteDocument(Long documentId, Long candidateId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Belge", documentId));

        if (!document.getStudent().getId().equals(candidateId)) {
            throw UnauthorizedException.keyed("error.document.notOwner");
        }

        fileStorageService.delete(document.getFilePath());
        documentRepository.delete(document);
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> getPublicDocuments(Long candidateId) {
        return List.of();
    }

    /**
     * Legacy compatibility: profile documents are no longer shared with applications.
     */
    @Transactional(readOnly = true)
    public List<DocumentDto> getAccessibleDocsForApplication(Long applicationId, Long ownerId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));

        if (!app.getJobListing().getBusiness().getOwner().getId().equals(ownerId)) {
            throw UnauthorizedException.keyed("error.application.notOwner");
        }

        return List.of();
    }

    /**
     * Retired public-link delivery. Existing records remain available for owner deletion.
     */
    @Transactional(readOnly = true)
    public String getDownloadUrl(Long documentId, Long requesterId, boolean isBusinessOwner) {
        throw new com.hotelapp.exception.BusinessRuleException("Bu eski profil belgesi artık paylaşılamıyor. Dosyayı ilgili sohbetten yeniden paylaşın.");
    }

    private DocumentDto toDto(Document doc) {
        LocalDate exp = doc.getExpiresAt();
        Boolean expired = null;
        Long daysToExpiry = null;
        if (exp != null) {
            LocalDate today = LocalDate.now();
            expired = exp.isBefore(today);
            daysToExpiry = ChronoUnit.DAYS.between(today, exp);   // negatif = geçmiş
        }
        return DocumentDto.builder()
                .id(doc.getId())
                .type(doc.getType())
                .originalFileName(doc.getOriginalFileName())
                .isSensitive(doc.isSensitive())
                .verified(doc.isVerified())
                .uploadedAt(doc.getUploadedAt())
                .expiresAt(exp)
                .expired(expired)
                .daysToExpiry(daysToExpiry)
                .build();
    }

    @Data @Builder
    public static class DocumentDto {
        private Long id;
        private DocumentType type;
        private String originalFileName;
        private boolean isSensitive;
        private boolean verified;
        private LocalDateTime uploadedAt;
        private LocalDate expiresAt;      // null = süresiz
        private Boolean expired;          // null = süresiz; true = süresi geçmiş
        private Long daysToExpiry;        // null = süresiz; negatif = geçmiş
    }
}
