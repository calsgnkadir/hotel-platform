package com.hotelapp.service;

import com.hotelapp.entity.Document;
import com.hotelapp.entity.User;
import com.hotelapp.enums.DocumentType;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.DocumentRepository;
import com.hotelapp.repository.DocumentRequestRepository;
import com.hotelapp.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final DocumentRequestRepository documentRequestRepository;
    private final UserRepository userRepository;
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

    public Resource downloadDocument(Long documentId, Long requesterId, boolean isBusinessOwner) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Belge", documentId));

        if (!isBusinessOwner) {
            if (!document.getStudent().getId().equals(requesterId)) {
                throw new UnauthorizedException("Bu belgeye erişim yetkiniz yok");
            }
            return loadResource(document.getFilePath());
        }

        if (!document.isSensitive()) {
            return loadResource(document.getFilePath());
        }

        boolean granted = documentRequestRepository.hasGrantedAccess(
                requesterId,
                document.getStudent().getId(),
                document.getType());

        if (!granted) {
            throw new UnauthorizedException(
                    "Bu belgeye erişmek için adaydan talep oluşturup onay almanız gerekiyor");
        }

        return loadResource(document.getFilePath());
    }

    private Resource loadResource(String filePath) {
        try {
            Path path = fileStorageService.getFullPath(filePath);
            Resource resource = new UrlResource(path.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new BusinessRuleException("Dosya okunamıyor, yeniden yüklemeyi deneyin");
            }
            return resource;
        } catch (MalformedURLException e) {
            throw new BusinessRuleException("Dosya yolu hatalı: " + e.getMessage());
        }
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
