package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * #76: Aday ↔ İşletme sahibi arasında 1 sohbet.
 * Aynı (candidate, businessOwner) çifti için sadece 1 Conversation olur.
 * Opsiyonel: bir başvuru bağlamında açılmışsa application referansı tutulur.
 */
@Entity
@Table(name = "conversations",
       uniqueConstraints = @UniqueConstraint(name = "uk_conv_candidate_business",
                                             columnNames = {"candidate_id", "business_owner_id"}),
       indexes = {
           @Index(name = "idx_conv_candidate",      columnList = "candidate_id"),
           @Index(name = "idx_conv_business_owner", columnList = "business_owner_id"),
           @Index(name = "idx_conv_last_message_at", columnList = "last_message_at"),
       })
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** CANDIDATE rolündeki kullanıcı. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private User candidate;

    /** BUSINESS_OWNER rolündeki kullanıcı (Business.owner). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "business_owner_id", nullable = false)
    private User businessOwner;

    /** Opsiyonel: sohbet bir başvuru bağlamında açıldıysa referans. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id")
    private Application application;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    /** Listede sıralama için — en son mesaj zamanı. */
    @Column(nullable = false)
    private LocalDateTime lastMessageAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (lastMessageAt == null) lastMessageAt = now;
    }
}
