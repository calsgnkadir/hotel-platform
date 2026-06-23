package com.hotelapp.repository;

import com.hotelapp.entity.BusinessBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Set;

public interface BusinessBlockRepository extends JpaRepository<BusinessBlock, Long> {

    boolean existsByUserIdAndBusinessId(Long userId, Long businessId);

    void deleteByUserIdAndBusinessId(Long userId, Long businessId);

    List<BusinessBlock> findByUserIdOrderByCreatedAtDesc(Long userId);

    /** Bulk lookup: aday'in engelledigi isletme id seti */
    @Query("SELECT b.business.id FROM BusinessBlock b WHERE b.user.id = :userId")
    Set<Long> findBusinessIdsByUserId(@Param("userId") Long userId);

    long countByUserId(Long userId);
}
