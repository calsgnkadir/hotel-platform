package com.hotelapp.repository;

import com.hotelapp.entity.Message;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MessageRepository extends JpaRepository<Message, Long> {

    /** Bir sohbetteki mesajlar, en yeniden eskiye (frontend ters çevirir). */
    Page<Message> findByConversationIdOrderBySentAtDesc(Long conversationId, Pageable pageable);

    /** Sohbete ait bir mesajın gönderici dışındaki taraf için son durumu (preview). */
    Message findFirstByConversationIdOrderBySentAtDesc(Long conversationId);

    /** Bu kullanıcının tüm sohbetlerinde kendisine gelen okunmamış mesaj sayısı. */
    @Query("""
        SELECT COUNT(m) FROM Message m
        WHERE m.conversation.id IN (
            SELECT c.id FROM Conversation c
            WHERE c.candidate.id = :userId OR c.businessOwner.id = :userId
        )
        AND m.sender.id <> :userId
        AND m.isRead = false
    """)
    long countUnreadForUser(@Param("userId") Long userId);

    /** Belirli bir sohbette bu kullanıcıya gelen okunmamış mesaj sayısı (preview için). */
    @Query("""
        SELECT COUNT(m) FROM Message m
        WHERE m.conversation.id = :conversationId
          AND m.sender.id <> :userId
          AND m.isRead = false
    """)
    long countUnreadInConversation(@Param("conversationId") Long conversationId,
                                   @Param("userId") Long userId);

    /** Sohbete girince: bu kullanıcıya gelen tüm mesajları okundu işaretle. */
    @Modifying
    @Query("""
        UPDATE Message m SET m.isRead = true
        WHERE m.conversation.id = :conversationId
          AND m.sender.id <> :userId
          AND m.isRead = false
    """)
    int markAllReadForUserInConversation(@Param("conversationId") Long conversationId,
                                         @Param("userId") Long userId);
}
