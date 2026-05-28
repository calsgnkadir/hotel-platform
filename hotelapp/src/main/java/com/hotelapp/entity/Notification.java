package com.hotelapp.entity;

import com.hotelapp.enums.NotificationType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * ADIM 4: In-app bildirim.
 * Bir kullanıcıya (recipient) gönderilir; zil ikonunda gösterilir.
 */
@Entity
@Table(name = "notifications", indexes = {
    @Index(name = "idx_notif_recipient", columnList = "recipient_id, isRead")
})
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationType type;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String message;

    // Frontend yönlendirmesi için opsiyonel hedef (örn. "applications")
    @Column(length = 50)
    private String link;

    // Boolean wrapper → Jackson "isRead" olarak serialize etsin
    @Column(nullable = false)
    @Builder.Default
    private Boolean isRead = false;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (isRead == null) isRead = false;
    }
}
