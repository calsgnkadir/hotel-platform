package com.hotelapp.repository;

import com.hotelapp.entity.Notification;
import com.hotelapp.enums.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findAllByRecipientIdOrderByCreatedAtDesc(Long recipientId, Pageable pageable);

    /** FAZ 11.W4.1 — Dedupe adayi: ayni recipient+type, okunmamis, pencere icinde. */
    Optional<Notification> findFirstByRecipientIdAndTypeAndIsReadFalseAndCreatedAtAfterOrderByCreatedAtDesc(
            Long recipientId, NotificationType type, LocalDateTime windowStart);

    @Query("SELECT COUNT(n) FROM Notification n WHERE n.recipient.id = :recipientId AND n.isRead = false")
    long countUnread(@Param("recipientId") Long recipientId);

    @Modifying
    @Query("UPDATE Notification n SET n.isRead = true WHERE n.recipient.id = :recipientId AND n.isRead = false")
    int markAllReadForRecipient(@Param("recipientId") Long recipientId);
}
