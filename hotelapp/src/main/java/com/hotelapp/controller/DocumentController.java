package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.enums.DocumentType;
import com.hotelapp.service.DocumentService;
import com.hotelapp.service.DocumentService.DocumentDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
@Tag(name = "4. Belgeler", description = "Belge yükleme, listeleme ve indirme")
@SecurityRequirement(name = "bearerAuth")
public class DocumentController {

    private final DocumentService documentService;

    @Operation(summary = "Belge yükle — sadece CANDIDATE")
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<DocumentDto> upload(
            @AuthenticationPrincipal User currentUser,
            @RequestParam("file") MultipartFile file,
            @RequestParam("type") DocumentType type) {
        return ResponseEntity.ok(documentService.upload(currentUser.getId(), file, type));
    }

    @Operation(summary = "Belgelerimi listele — sadece CANDIDATE")
    @GetMapping("/my")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<List<DocumentDto>> myDocuments(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(documentService.listMyDocuments(currentUser.getId()));
    }

    @Operation(summary = "Belge sil — sadece CANDIDATE")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ResponseEntity<Map<String, String>> delete(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        documentService.deleteDocument(id, currentUser.getId());
        return ResponseEntity.ok(Map.of("message", "Belge silindi"));
    }

    @Operation(summary = "Adayın açık belgelerini listele — sadece BUSINESS_OWNER")
    @GetMapping("/candidate/{candidateId}/public")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    public ResponseEntity<List<DocumentDto>> publicDocuments(@PathVariable Long candidateId) {
        return ResponseEntity.ok(documentService.getPublicDocuments(candidateId));
    }

    @Operation(
            summary = "Dosya indir — CANDIDATE veya BUSINESS_OWNER",
            description = "Cloudinary signed URL'ye 302 redirect döner. Browser/axios redirect'i takip eder."
    )
    @GetMapping("/{id}/download")
    @PreAuthorize("hasAnyRole('CANDIDATE','BUSINESS_OWNER')")
    public ResponseEntity<Void> download(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        boolean isBusinessOwner = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_BUSINESS_OWNER"));
        String url = documentService.getDownloadUrl(id, currentUser.getId(), isBusinessOwner);
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(url))
                .build();
    }

    @Operation(
            summary = "Dosya görüntüleme URL'si al — CANDIDATE veya BUSINESS_OWNER",
            description = "Erişim kontrolünü yapar ve Cloudinary signed URL'yi JSON olarak döner. " +
                    "Frontend bu URL'yi window.open() ile açabilir."
    )
    @GetMapping("/{id}/url")
    @PreAuthorize("hasAnyRole('CANDIDATE','BUSINESS_OWNER')")
    public ResponseEntity<Map<String, String>> getDownloadUrl(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long id) {
        boolean isBusinessOwner = currentUser.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_BUSINESS_OWNER"));
        String url = documentService.getDownloadUrl(id, currentUser.getId(), isBusinessOwner);
        return ResponseEntity.ok(Map.of("url", url));
    }
}
