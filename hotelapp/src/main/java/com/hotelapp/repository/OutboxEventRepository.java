package com.hotelapp.repository;

import com.hotelapp.entity.OutboxEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    /** Pending event'leri eski-once sirayla — batch limit Pageable ile. */
    @Query("""
        SELECT e FROM OutboxEvent e
        WHERE e.processedAt IS NULL
          AND e.attempts < 5
        ORDER BY e.createdAt ASC
    """)
    List<OutboxEvent> findUnprocessed(Pageable pageable);

    /** FAZ D.4 — Prometheus gauge için pending count. */
    long countByProcessedAtIsNull();

    // FAZ D.5 — Admin DLQ goruntuleme

    /** Tüm event'ler — en yeni önce. */
    org.springframework.data.domain.Page<OutboxEvent>
        findAllByOrderByCreatedAtDesc(org.springframework.data.domain.Pageable pageable);

    /** Pending: henuz teslim edilmemis (processedAt NULL). */
    org.springframework.data.domain.Page<OutboxEvent>
        findAllByProcessedAtIsNullOrderByCreatedAtDesc(org.springframework.data.domain.Pageable pageable);

    /** Dead-letter: max retry asilmis, processedAt NULL. */
    @Query("""
        SELECT e FROM OutboxEvent e
        WHERE e.processedAt IS NULL
          AND e.attempts >= 5
        ORDER BY e.createdAt DESC
    """)
    org.springframework.data.domain.Page<OutboxEvent>
        findDeadLetters(org.springframework.data.domain.Pageable pageable);
}
