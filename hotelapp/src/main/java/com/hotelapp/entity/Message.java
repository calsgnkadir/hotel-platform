package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * #76: Bir Conversation içindeki tek mesaj.
 * isRead = recipient (gönderici olmayan) tarafından okundu mu?
 * Sender her zaman kendi mesajını okumuş sayılır — semantik: "karşı taraf gördü mü".
 */
@Entity
@Table(name = "messages",
       indexes = {
           @Index(name = "idx_msg_conversation",         columnList = "conversation_id, sent_at"),
           @Index(name = "idx_msg_conversation_unread",  columnList = "conversation_id, is_read"),
       })
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    // Mesaj metni — attachment'lı mesajda boş olabilir (sadece dosya)
    @Column(nullable = false, columnDefinition = "TEXT")
    @Builder.Default
    private String content = "";

    // ── Attachment alanları (refactor v2: chat-only akış) ──
    /** Cloudinary public URL (image/file/audio). null = sadece metin mesajı. */
    @Column(name = "attachment_url", length = 500)
    private String attachmentUrl;

    /** image | file | audio  — frontend'in render kararı için */
    @Column(name = "attachment_type", length = 20)
    private String attachmentType;

    /** Orijinal dosya adı (ör: cv.pdf) */
    @Column(name = "attachment_name", length = 200)
    private String attachmentName;

    /** Bayt cinsinden boyut (UI'da KB/MB göstermek için) */
    @Column(name = "attachment_size")
    private Long attachmentSize;

    @Column(name = "sent_at", nullable = false)
    private LocalDateTime sentAt;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private Boolean isRead = false;

    @PrePersist
    protected void onCreate() {
        if (sentAt == null) sentAt = LocalDateTime.now();
        if (isRead == null) isRead = false;
    }
}
