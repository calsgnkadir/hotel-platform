package com.hotelapp.service;

import com.hotelapp.entity.Notification;
import com.hotelapp.entity.User;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.repository.NotificationRepository;
import com.hotelapp.repository.UserRepository;
import lombok.Builder;
import lombok.Data;
import com.hotelapp.config.AfterCommit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.Executor;

/**
 * ADIM 4: In-app bildirim servisi.
 *
 * <p>notify(...) cagirani bloklamaz ve dis transaction'a baglanti eklemez:
 * <ul>
 *   <li>Dis transaction varsa is commit SONRASINA ertelenir; dis islem geri alinirsa
 *       bildirim hic yazilmaz/gonderilmez (olmayan olayin bildirimi gitmez).</li>
 *   <li>Transaction yoksa hemen kuyruga alinir.</li>
 *   <li>Kayit (dedupe dahil) {@code notificationExecutor} thread'inde kendi kisa
 *       transaction'inda yapilir; WS + web push o transaction commit olduktan sonra
 *       (baglanti iade edilmisken) gonderilir.</li>
 * </ul>
 * Hata ana akisi bozmaz (try-catch).
 */
@Service
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;  // FAZ 1/#22 — WS push
    private final WebPushService webPushService;            // FAZ 1/#23 — Web Push (pure Java)
    private final Executor notificationExecutor;
    private final TransactionTemplate writeTx;

    /** FAZ 11.W4.1 — Dedupe penceresi: bu sure icinde ayni type+recipient collapse edilir. */
    private static final java.time.Duration DEDUPE_WINDOW = java.time.Duration.ofMinutes(5);

    /** Alici bazli kilit seritleri (dedupe yarisini onler; tek uygulama ornegi icinde). */
    private static final Object[] STRIPES = new Object[64];
    static {
        for (int i = 0; i < STRIPES.length; i++) STRIPES[i] = new Object();
    }

    public NotificationService(NotificationRepository notificationRepository,
                               UserRepository userRepository,
                               SimpMessagingTemplate messagingTemplate,
                               WebPushService webPushService,
                               @Qualifier("notificationExecutor") Executor notificationExecutor,
                               PlatformTransactionManager transactionManager) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
        this.webPushService = webPushService;
        this.notificationExecutor = notificationExecutor;
        this.writeTx = new TransactionTemplate(transactionManager);
        // REQUIRES_NEW: kuyruk tasip CallerRuns ile afterCommit icinde kosarsa, commit
        // edilmis dis transaction'a "katilip" yazinin kaybolmasini onler.
        this.writeTx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Bildirim olustur — imza degismedi; davranis: commit sonrasi + asenkron.
     *
     * FAZ 11.W4.1 — Dedupe: son 5dk icinde ayni recipient+type'ta OKUNMAMIS bir
     * bildirim varsa yeni kayit acilmaz; mevcidin aggregateCount'u artar, message
     * en yenisiyle degistirilir, createdAt tazelenir (listede uste cikar).
     * "24 ayri bildirim" yerine "Yeni basvuru (×24)".
     */
    public void notify(Long recipientId, NotificationType type, String title, String message, String link) {
        try {
            AfterCommit.run(() -> submit(() -> deliver(recipientId, type, title, message, link)));
        } catch (Exception e) {
            log.warn("Bildirim kuyruga alinamadi: type={} recipient={} - {}", type, recipientId, e.getMessage());
        }
    }

    private void submit(Runnable job) {
        try {
            notificationExecutor.execute(job);
        } catch (Exception e) {
            log.warn("Bildirim executor'a verilemedi: {}", e.getMessage());
        }
    }

    /** Kayit (kisa transaction) + commit sonrasi WS/web push. Hata yutulur. */
    void deliver(Long recipientId, NotificationType type, String title, String message, String link) {
        Persisted p;
        // Ayni alicinin bildirimleri seri yazilir: paralel iki worker ayni anda "okunmamis
        // kayit yok" gorup dedupe'u bozmasin. Kilit transaction'dan ONCE alinir — bekleyen
        // thread DB baglantisi tutmaz.
        synchronized (STRIPES[Math.floorMod(recipientId.hashCode(), STRIPES.length)]) {
            try {
                p = writeTx.execute(status -> persist(recipientId, type, title, message, link));
            } catch (Exception e) {
                log.warn("Bildirim oluşturulamadı: type={} recipient={} - {}", type, recipientId, e.getMessage());
                return;
            }
        }
        if (p == null) return;

        // FAZ 1/#22 — WebSocket push: kullanıcıya anında bildirim
        try {
            messagingTemplate.convertAndSendToUser(p.email(), "/queue/notifications", p.dto());
        } catch (Exception wsErr) {
            log.warn("WS notify push failed: {}", wsErr.getMessage());
        }

        // FAZ 1/#23 — Web Push (tab kapali bile bildirim gelir) — icerikli
        try {
            int count = p.dto().getAggregateCount();
            webPushService.sendToUser(recipientId, new WebPushService.PushMessage(
                    count > 1 ? title + " (" + count + ")" : title,
                    message,
                    p.pushUrl(),
                    p.dto().getId()));
        } catch (Exception pushErr) {
            log.warn("Web push send failed: {}", pushErr.getMessage());
        }
    }

    private record Persisted(String email, String pushUrl, NotificationDto dto) {}

    private Persisted persist(Long recipientId, NotificationType type, String title, String message, String link) {
        User recipient = userRepository.findById(recipientId).orElse(null);
        if (recipient == null) return null;

        Notification n;
        var existing = notificationRepository
                .findFirstByRecipientIdAndTypeAndIsReadFalseAndCreatedAtAfterOrderByCreatedAtDesc(
                        recipientId, type, LocalDateTime.now().minus(DEDUPE_WINDOW));
        if (existing.isPresent()) {
            n = existing.get();
            n.setAggregateCount((n.getAggregateCount() == null ? 1 : n.getAggregateCount()) + 1);
            n.setMessage(message);          // en yeni icerik gorunur
            n.setTitle(title);
            n.setLink(link);
            n.setCreatedAt(LocalDateTime.now());  // listede uste tasi
            n = notificationRepository.save(n);
        } else {
            n = Notification.builder()
                    .recipient(recipient)
                    .type(type)
                    .title(title)
                    .message(message)
                    .link(link)
                    .isRead(false)
                    .createdAt(LocalDateTime.now())
                    .build();
            n = notificationRepository.save(n);
        }
        return new Persisted(recipient.getEmail(), pushUrl(recipient, link), toDto(n));
    }

    /**
     * Bildirim link'i uygulamada iki bicimde: tam adres ("/listings/42") ya da
     * panel sekmesi ("applications"). Telefon bildirimine dokununca acilacak tam adres.
     */
    static String pushUrl(User recipient, String link) {
        if (link != null && link.startsWith("/")) return link;
        var role = recipient.getRole();
        String panel = role == com.hotelapp.enums.Role.BUSINESS_OWNER ? "/business"
                : role == com.hotelapp.enums.Role.ADMIN ? "/admin"
                : "/candidate";
        return (link == null || link.isBlank()) ? panel : panel + "?tab=" + link;
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
                .aggregateCount(n.getAggregateCount() == null ? 1 : n.getAggregateCount())
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
        /** FAZ 11.W4.1 — kac bildirim bu kayda collapse edildi (1 = tekil) */
        private Integer aggregateCount;
    }
}
