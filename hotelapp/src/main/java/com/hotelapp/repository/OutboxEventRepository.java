package com.hotelapp.repository;

import com.hotelapp.entity.OutboxEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, Long> {

    /** Pending event'leri eski-once sirayla — batch limit Pageable ile.
     *  FAZ F.4: maxAttempts parametre — magic 5 tekrar etmesin (OutboxRelay.MAX_ATTEMPTS). */
    @Query("""
        SELECT e FROM OutboxEvent e
        WHERE e.processedAt IS NULL
          AND e.attempts < :maxAttempts
        ORDER BY e.createdAt ASC
    """)
    List<OutboxEvent> findUnprocessed(
            @org.springframework.data.repository.query.Param("maxAttempts") int maxAttempts,
            Pageable pageable);

    /** FAZ D.4 — Prometheus gauge için pending count. */
    long countByProcessedAtIsNull();

    // FAZ D.5 — Admin DLQ goruntuleme

    /** Tüm event'ler — en yeni önce. */
    org.springframework.data.domain.Page<OutboxEvent>
        findAllByOrderByCreatedAtDesc(org.springframework.data.domain.Pageable pageable);

    /** Pending: henuz teslim edilmemis (processedAt NULL). */
    org.springframework.data.domain.Page<OutboxEvent>
        findAllByProcessedAtIsNullOrderByCreatedAtDesc(org.springframework.data.domain.Pageable pageable);

    /** Dead-letter: max retry asilmis, processedAt NULL.
     *  FAZ F.4: minAttempts parametre — magic 5 tekrar etmesin. */
    @Query("""
        SELECT e FROM OutboxEvent e
        WHERE e.processedAt IS NULL
          AND e.attempts >= :minAttempts
        ORDER BY e.createdAt DESC
    """)
    org.springframework.data.domain.Page<OutboxEvent> findDeadLetters(
            @org.springframework.data.repository.query.Param("minAttempts") int minAttempts,
            org.springframework.data.domain.Pageable pageable);

    /** FAZ F.6 — Eski teslim edilmis event'leri sil (tablo sismesini onler). */
    @Modifying
    @Query("DELETE FROM OutboxEvent e WHERE e.processedAt IS NOT NULL AND e.processedAt < :cutoff")
    int deleteProcessedOlderThan(
            @org.springframework.data.repository.query.Param("cutoff") java.time.LocalDateTime cutoff);
}
