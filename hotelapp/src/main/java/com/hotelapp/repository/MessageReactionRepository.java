package com.hotelapp.repository;

import com.hotelapp.entity.MessageReaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MessageReactionRepository extends JpaRepository<MessageReaction, Long> {

    Optional<MessageReaction> findByMessageIdAndUserId(Long messageId, Long userId);

    List<MessageReaction> findAllByMessageId(Long messageId);

    /** FAZ 11.W3 — Sayfa dolusu mesajin reaksiyonlarini tek sorguda topla (N+1 onleme). */
    @Query("SELECT r FROM MessageReaction r WHERE r.message.id IN :messageIds")
    List<MessageReaction> findAllByMessageIdIn(@Param("messageIds") List<Long> messageIds);
}
