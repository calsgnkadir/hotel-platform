package com.hotelapp.repository;

import com.hotelapp.entity.Conversation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ConversationRepository extends JpaRepository<Conversation, Long> {

    /** Belirli bir aday + işletme sahibi çifti için var olan sohbet (yoksa empty). */
    Optional<Conversation> findByCandidateIdAndBusinessOwnerId(Long candidateId, Long businessOwnerId);

    /** Bir kullanıcının (aday VEYA işletme sahibi) tüm sohbetleri, son mesaja göre azalan. */
    @Query("""
        SELECT c FROM Conversation c
        WHERE c.candidate.id = :userId OR c.businessOwner.id = :userId
    """)
    Page<Conversation> findForUser(@Param("userId") Long userId, Pageable pageable);
}
