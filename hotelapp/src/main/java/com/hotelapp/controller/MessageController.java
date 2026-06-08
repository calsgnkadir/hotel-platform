package com.hotelapp.controller;

import com.hotelapp.dto.ConversationDto;
import com.hotelapp.dto.MessageDto;
import com.hotelapp.dto.MessageRequest;
import com.hotelapp.dto.PageResponse;
import com.hotelapp.dto.StartConversationRequest;
import com.hotelapp.entity.User;
import com.hotelapp.service.MessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/messages")
@Tag(name = "C. Mesajlaşma", description = "Aday ↔ İşletme sohbeti")
public class MessageController {

    private final MessageService messageService;

    @Operation(summary = "Sohbetlerimi listele (sayfalı, son mesaja göre)")
    @GetMapping("/conversations")
    @PreAuthorize("hasAnyRole('CANDIDATE','BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<PageResponse<ConversationDto>> myConversations(
            @AuthenticationPrincipal User currentUser,
            @PageableDefault(size = 20, sort = "lastMessageAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return ResponseEntity.ok(
                messageService.getMyConversations(currentUser.getId(), pageable));
    }

    @Operation(
            summary = "Yeni sohbet aç (idempotent — varsa mevcudu döner)",
            description = "otherPartyId zorunlu. applicationId opsiyonel."
    )
    @PostMapping("/conversations")
    @PreAuthorize("hasAnyRole('CANDIDATE','BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ConversationDto> startConversation(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody StartConversationRequest req) {
        ConversationDto dto = messageService.startConversation(currentUser.getId(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @Operation(summary = "Sohbetin mesajlarını listele (sayfalı, en yeniden eskiye)")
    @GetMapping("/conversations/{conversationId}/messages")
    @PreAuthorize("hasAnyRole('CANDIDATE','BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<PageResponse<MessageDto>> getMessages(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long conversationId,
            @PageableDefault(size = 50, sort = "sentAt", direction = Sort.Direction.DESC)
            Pageable pageable) {
        return ResponseEntity.ok(
                messageService.getMessages(conversationId, currentUser.getId(), pageable));
    }

    @Operation(summary = "Sohbete yeni mesaj gönder")
    @PostMapping("/conversations/{conversationId}/messages")
    @PreAuthorize("hasAnyRole('CANDIDATE','BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<MessageDto> sendMessage(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long conversationId,
            @Valid @RequestBody MessageRequest req) {
        MessageDto dto = messageService.sendMessage(conversationId, currentUser.getId(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @Operation(summary = "Sohbete dosya/foto ekle (multipart). Metin opsiyonel.")
    @PostMapping(value = "/conversations/{conversationId}/attachment",
                 consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('CANDIDATE','BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<MessageDto> sendAttachment(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long conversationId,
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "caption", required = false) String caption) {
        MessageDto dto = messageService.sendAttachment(conversationId, currentUser.getId(), file, caption);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @Operation(summary = "Sohbete giriş — bu kullanıcıya gelen mesajları okundu işaretle")
    @PutMapping("/conversations/{conversationId}/read")
    @PreAuthorize("hasAnyRole('CANDIDATE','BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Map<String, Integer>> markRead(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long conversationId) {
        int updated = messageService.markRead(conversationId, currentUser.getId());
        return ResponseEntity.ok(Map.of("updated", updated));
    }

    @Operation(summary = "Tüm sohbetlerimde okunmamış mesaj sayısı (zil/badge için)")
    @GetMapping("/unread-count")
    @PreAuthorize("hasAnyRole('CANDIDATE','BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Map<String, Long>> unreadCount(
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(Map.of("unread", messageService.countUnread(currentUser.getId())));
    }
}
