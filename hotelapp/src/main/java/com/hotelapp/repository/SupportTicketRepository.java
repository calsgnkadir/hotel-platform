package com.hotelapp.repository;

import com.hotelapp.entity.SupportTicket;
import com.hotelapp.enums.SupportStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, Long> {

    /** Kullanıcı kendi biletlerini görür. */
    List<SupportTicket> findAllByUserIdOrderByCreatedAtDesc(Long userId);

    /** Admin: status filtreli liste (status null → tümü). */
    @Query("""
        SELECT t FROM SupportTicket t
        WHERE (:status IS NULL OR t.status = :status)
        ORDER BY t.createdAt DESC
    """)
    Page<SupportTicket> searchForAdmin(@Param("status") SupportStatus status, Pageable pageable);

    /** Pulse/admin metric için "açık" sayım. */
    long countByStatus(SupportStatus status);
}
