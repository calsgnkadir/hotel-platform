package com.hotelapp.repository;

import com.hotelapp.entity.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, Long> {

    List<PushSubscription> findAllByUserId(Long userId);

    Optional<PushSubscription> findByUserIdAndEndpoint(Long userId, String endpoint);

    @Modifying
    @Query("DELETE FROM PushSubscription p WHERE p.user.id = :userId AND p.endpoint = :endpoint")
    int deleteByUserIdAndEndpoint(@Param("userId") Long userId, @Param("endpoint") String endpoint);

    @Modifying
    @Query("DELETE FROM PushSubscription p WHERE p.endpoint = :endpoint")
    int deleteByEndpoint(@Param("endpoint") String endpoint);
}
