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
}
