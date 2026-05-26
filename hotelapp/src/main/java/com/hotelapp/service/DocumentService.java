package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Document;
import com.hotelapp.entity.DocumentRequest;
import com.hotelapp.entity.User;
import com.hotelapp.enums.DocumentRequestStatus;
import com.hotelapp.enums.DocumentType;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.DocumentRepository;
import com.hotelapp.repository.DocumentRequestRepository;
import com.hotelapp.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final DocumentRequestRepository documentRequestRepository;
    private final UserRepository userRepository;
    private final ApplicationRepository applicationRepository;
    private final FileStorageService fileStorageService;

    private static final Set<DocumentType> SENSITIVE_TYPES = Set.of(
            DocumentType.CRIMINAL_RECORD,
            DocumentType.HEALTH_CERTIFICATE,
            DocumentType.IDENTITY_DOCUMENT);

    @Transactional
    public DocumentDto upload(Long candidateId, MultipartFile file, DocumentType type) {
        User candidate = userRepository.findById(candidateId)
                .orElseThrow(() -> new ResourceNotFoundException("Aday", candidateId));

        documentRepository.findByStudentIdAndType(candidateId, type).ifPresent(existing -> {
            fileStorageService.delete(existing.getFilePath());
            documentRepository.delete(existing);
        });

        String filePath = fileStorageService.store(file, candidateId);

        Document document = Document.builder()
                .student(candidate)
                .type(type)
                .filePath(filePath)
                .originalFileName(file.getOriginalFilename())
                .isSensitive(SENSITIVE_TYPES.contains(type))
                .build();

        documentRepository.save(document);
        return toDto(document);
    }

    public List<DocumentDto> listMyDocuments(Long candidateId) {
        return documentRepository.findAllByStudentId(candidateId)
                .stream().map(this::toDto).toList();
    }

    @Transactional
    public void deleteDocument(Long documentId, Long candidateId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Belge", documentId));

        if (!document.getStudent().getId().equals(candidateId)) {
            throw new UnauthorizedException("Bu belge size ait değil");
        }

        fileStorageService.delete(document.getFilePath());
        documentRepository.delete(document);
    }

    public List<DocumentDto> getPublicDocuments(Long candidateId) {
        return documentRepository.findAllByStudentIdAndIsSensitiveFalse(candidateId)
                .stream().map(this::toDto).toList();
    }

    /**
     * İşletme sahibinin bir başvuru için erişebileceği tüm belgeleri döner.
     * - Adayın tüm AÇIK (sensitive=false) belgeleri
     * - Bu başvuru için GRANTED durumda olan hassas belge tiplerine ait belgeler
     */
    @Transactional(readOnly = true)
    public List<DocumentDto> getAccessibleDocsForApplication(Long applicationId, Long ownerId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));

        if (!app.getJobListing().getBusiness().getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Bu başvuru size ait değil");
        }

        Set<DocumentType> grantedSensitiveTypes = app.getDocumentRequests().stream()
                .filter(dr -> dr.getStatus() == DocumentRequestStatus.GRANTED)
                .map(DocumentRequest::getDocumentType)
                .collect(Collectors.toSet());

        Long candidateId = app.getCandidate().getId();
        return documentRepository.findAllByStudentId(candidateId).stream()
                .filter(d -> !d.isSensitive() || grantedSensitiveTypes.contains(d.getType()))
                .map(this::toDto)
                .toList();
    }

    /**
     * Belgeye erişim kontrolü yapar ve Cloudinary signed URL döner.
     * Caller (controller) bu URL'ye 302 redirect eder.
     */
    public String getDownloadUrl(Long documentId, Long requesterId, boolean isBusinessOwner) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Belge", documentId));

        if (!isBusinessOwner) {
            // Aday kendi belgesini her zaman görebilir
            if (!document.getStudent().getId().equals(requesterId)) {
                throw new UnauthorizedException("Bu belgeye erişim yetkiniz yok");
            }
            return fileStorageService.publicUrl(document.getFilePath());
        }

        // İşletme sahibi — hassas olmayan belgelere erişebilir
        if (!document.isSensitive()) {
            return fileStorageService.publicUrl(document.getFilePath());
        }

        // Hassas belge → talep + onay kontrolü
        boolean granted = documentRequestRepository.hasGrantedAccess(
                requesterId,
                document.getStudent().getId(),
                document.getType());

        if (!granted) {
            throw new UnauthorizedException(
                    "Bu belgeye erişmek için adaydan talep oluşturup onay almanız gerekiyor");
        }

        return fileStorageService.publicUrl(document.getFilePath());
    }

    private DocumentDto toDto(Document doc) {
        return DocumentDto.builder()
                .id(doc.getId())
                .type(doc.getType())
                .originalFileName(doc.getOriginalFileName())
                .isSensitive(doc.isSensitive())
                .verified(doc.isVerified())
                .uploadedAt(doc.getUploadedAt())
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
    }
}
