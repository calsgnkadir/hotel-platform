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

    /** Bu adayi engellemis isletmelerin id seti (toplu bildirim filtresi). */
    @org.springframework.data.jpa.repository.Query(
            "SELECT b.business.id FROM CandidateBlock b WHERE b.candidate.id = :candidateId")
    java.util.Set<Long> findBusinessIdsByCandidateId(
            @org.springframework.data.repository.query.Param("candidateId") Long candidateId);

    /** Sahibi ownerId olan isletmenin engelledigi aday id'leri (presence filtresi). */
    @org.springframework.data.jpa.repository.Query(
            "SELECT b.candidate.id FROM CandidateBlock b WHERE b.business.owner.id = :ownerId")
    java.util.Set<Long> findCandidateIdsByBusinessOwnerId(
            @org.springframework.data.repository.query.Param("ownerId") Long ownerId);

    /** Bu adayi engelleyen isletmelerin sahip id'leri (presence filtresi). */
    @org.springframework.data.jpa.repository.Query(
            "SELECT b.business.owner.id FROM CandidateBlock b WHERE b.candidate.id = :candidateId")
    java.util.Set<Long> findBusinessOwnerIdsByCandidateId(
            @org.springframework.data.repository.query.Param("candidateId") Long candidateId);

    /** Isletmenin engelledigi adaylar, en yenisi ustte (aday tek sorguda gelir). */
    @EntityGraph(attributePaths = "candidate")
    List<CandidateBlock> findByBusinessIdOrderByCreatedAtDesc(Long businessId);
}
