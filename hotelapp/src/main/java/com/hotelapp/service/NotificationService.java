package com.hotelapp.service;

import com.hotelapp.entity.Notification;
import com.hotelapp.entity.User;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.repository.NotificationRepository;
import com.hotelapp.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * ADIM 4: In-app bildirim servisi.
 * notify(...) bildirim oluşturur; hata ana akışı bozmaz (try-catch).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;  // FAZ 1/#22 — WS push

    /**
     * Bildirim oluştur. REQUIRES_NEW ile kendi tx'ında çalışır — başarısız olursa
     * çağıran metodun transaction'ını etkilemez (örn. ilan oluşturma).
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notify(Long recipientId, NotificationType type, String title, String message, String link) {
        try {
            User recipient = userRepository.findById(recipientId).orElse(null);
            if (recipient == null) return;
            Notification n = Notification.builder()
                    .recipient(recipient)
                    .type(type)
                    .title(title)
                    .message(message)
                    .link(link)
                    .isRead(false)
                    .createdAt(LocalDateTime.now())
                    .build();
            n = notificationRepository.save(n);

            // FAZ 1/#22 — WebSocket push: kullanıcıya anında bildirim
            // FIX: convertAndSendToUser → Principal.getName() = EMAIL (id degil)
            try {
                messagingTemplate.convertAndSendToUser(
                        recipient.getEmail(),
                        "/queue/notifications",
                        toDto(n)
                );
            } catch (Exception wsErr) {
                log.warn("WS notify push failed: {}", wsErr.getMessage());
            }
        } catch (Exception e) {
            log.warn("Bildirim oluşturulamadı: type={} recipient={} - {}", type, recipientId, e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public long countUnread(Long recipientId) {
        return notificationRepository.countUnread(recipientId);
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> list(Long recipientId, int limit) {
        var pageable = PageRequest.of(0, Math.min(limit, 50));
        return notificationRepository.findAllByRecipientIdOrderByCreatedAtDesc(recipientId, pageable)
                .getContent().stream().map(this::toDto).toList();
    }

    @Transactional
    public void markRead(Long notificationId, Long recipientId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (n.getRecipient().getId().equals(recipientId)) {
                n.setIsRead(true);
                notificationRepository.save(n);
            }
        });
    }

    @Transactional
    public void markAllRead(Long recipientId) {
        notificationRepository.markAllReadForRecipient(recipientId);
    }

    private NotificationDto toDto(Notification n) {
        return NotificationDto.builder()
                .id(n.getId())
                .type(n.getType())
                .title(n.getTitle())
                .message(n.getMessage())
                .link(n.getLink())
                .isRead(n.getIsRead())
                .createdAt(n.getCreatedAt())
                .build();
    }

    @Data @Builder
    public static class NotificationDto {
        private Long id;
        private NotificationType type;
        private String title;
        private String message;
        private String link;
        private Boolean isRead;
        private LocalDateTime createdAt;
    }
}
