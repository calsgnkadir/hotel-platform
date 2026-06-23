package com.hotelapp.repository;

import com.hotelapp.entity.BusinessFollow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;

public interface BusinessFollowRepository extends JpaRepository<BusinessFollow, Long> {

    boolean existsByUserIdAndBusinessId(Long userId, Long businessId);

    void deleteByUserIdAndBusinessId(Long userId, Long businessId);

    /** Aday'in takip ettigi isletmeler, yeniden eskiye */
    List<BusinessFollow> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** Isletmeye gelen takipci sayisi (BusinessPublicPage'de gosterilebilir) */
    long countByBusinessId(Long businessId);

    /** Bulk lookup: hangi isletme id'leri takipte */
    @Query("SELECT f.business.id FROM BusinessFollow f WHERE f.user.id = :userId")
    Set<Long> findBusinessIdsByUserId(@Param("userId") Long userId);

    long countByUserId(Long userId);
}
