package com.hotelapp.repository;

import com.hotelapp.entity.CandidateBlock;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CandidateBlockRepository extends JpaRepository<CandidateBlock, Long> {

    /** Isletme bu adayi engellemis mi (basvuru kapisi). */
    boolean existsByBusinessIdAndCandidateId(Long businessId, Long candidateId);

    /** Sahibi ownerId olan isletme bu adayi engellemis mi (mesajlasma kapisi). */
    boolean existsByBusinessOwnerIdAndCandidateId(Long ownerId, Long candidateId);

    Optional<CandidateBlock> findByBusinessIdAndCandidateId(Long businessId, Long candidateId);

    void deleteByBusinessIdAndCandidateId(Long businessId, Long candidateId);

    /** Isletmenin engelledigi adaylar, en yenisi ustte (aday tek sorguda gelir). */
    @EntityGraph(attributePaths = "candidate")
    List<CandidateBlock> findByBusinessIdOrderByCreatedAtDesc(Long businessId);
}
