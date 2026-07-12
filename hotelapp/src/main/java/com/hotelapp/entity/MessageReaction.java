package com.hotelapp.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * FAZ 11.W3 — Mesaj reaksiyonu.
 *
 * WhatsApp modeli: kullanici basina mesaj basina 1 reaksiyon
 * (UNIQUE message_id + user_id). Ayni reaksiyona tekrar basmak kaldirir,
 * farkli reaksiyon eskisini degistirir (MessageService.toggleReaction).
 *
 * reaction degerleri whitelist'te: heart, check, question, thumbs-up, alert, x
 * (UI'da SVG olarak render edilir — emoji yok, proje kurali).
 */
@Entity
@Table(name = "message_reactions",
       uniqueConstraints = @UniqueConstraint(name = "uq_reaction_msg_user",
                                             columnNames = {"message_id", "user_id"}))
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false)
    private Message message;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    private String reaction;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
