package com.hotelapp.repository;

import com.hotelapp.entity.UserAvailabilityBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserAvailabilityBlockRepository extends JpaRepository<UserAvailabilityBlock, Long> {

    List<UserAvailabilityBlock> findByUserIdOrderByDayOfWeekAscStartTimeAsc(Long userId);

    /**
     * Toplu müsaitlik okuması: yeni ilan eşleştirmesinde aday başına ayrı sorgu (N+1)
     * yerine aday kümesinin bloklarını tek IN sorgusuyla getirir. Çağıran listeyi parçalar.
     */
    @Query("SELECT b FROM UserAvailabilityBlock b WHERE b.user.id IN :userIds")
    List<UserAvailabilityBlock> findAllByUserIdIn(@Param("userIds") java.util.Collection<Long> userIds);

    @Modifying
    @Query("DELETE FROM UserAvailabilityBlock b WHERE b.user.id = :userId")
    void deleteAllByUserId(@Param("userId") Long userId);
}
