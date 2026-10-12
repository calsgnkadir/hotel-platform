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

    /** Sahibi ownerId olan isletmeyi engelleyen aday id'leri (presence filtresi). */
    @Query("SELECT b.user.id FROM BusinessBlock b WHERE b.business.owner.id = :ownerId")
    Set<Long> findUserIdsByBusinessOwnerId(@Param("ownerId") Long ownerId);

    /** Adayin engelledigi isletmelerin sahip id'leri (presence filtresi). */
    @Query("SELECT b.business.owner.id FROM BusinessBlock b WHERE b.user.id = :userId")
    Set<Long> findBusinessOwnerIdsByUserId(@Param("userId") Long userId);

    /** Aday, sahibi ownerId olan isletmeyi engellemis mi (mesajlasma kapisi). */
    boolean existsByUserIdAndBusinessOwnerId(Long userId, Long ownerId);
}
