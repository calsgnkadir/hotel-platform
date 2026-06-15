package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.service.NotificationService;
import com.hotelapp.service.NotificationService.NotificationDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "10. Bildirimler", description = "In-app bildirimler")
public class NotificationController {

    private final NotificationService notificationService;

    @Operation(summary = "Bildirimlerimi listele (son N)")
    @GetMapping
    public ResponseEntity<List<NotificationDto>> list(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @RequestParam(required = false, defaultValue = "20") int limit) {
        return ResponseEntity.ok(notificationService.list(currentUser.getId(), limit));
    }

    @Operation(summary = "Okunmamış bildirim sayısı")
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(@AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        return ResponseEntity.ok(Map.of("count", notificationService.countUnread(currentUser.getId())));
    }

    @Operation(summary = "Bir bildirimi okundu işaretle")
    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markRead(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long id) {
        notificationService.markRead(id, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Tüm bildirimleri okundu işaretle")
    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        notificationService.markAllRead(currentUser.getId());
        return ResponseEntity.noContent().build();
    }
}
