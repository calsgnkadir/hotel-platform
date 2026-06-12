package com.hotelapp.repository;

import com.hotelapp.entity.BusinessFavorite;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BusinessFavoriteRepository extends JpaRepository<BusinessFavorite, Long> {

    /** Isletmenin tum favorileri, en yenisi ustte */
    List<BusinessFavorite> findByBusinessIdOrderByCreatedAtDesc(Long businessId);

    /** Bir adayin kac isletme tarafindan favorilendigi (aday motivasyon rozeti icin) */
    long countByCandidateId(Long candidateId);

    /** Isletme bu adayi favori yapti mi? (toggle icin) */
    boolean existsByBusinessIdAndCandidateId(Long businessId, Long candidateId);

    /** Belirli kayit (unfavorite icin) */
    Optional<BusinessFavorite> findByBusinessIdAndCandidateId(Long businessId, Long candidateId);
}
