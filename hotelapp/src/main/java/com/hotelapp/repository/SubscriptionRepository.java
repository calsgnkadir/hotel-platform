package com.hotelapp.repository;

import com.hotelapp.entity.Subscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SubscriptionRepository extends JpaRepository<Subscription, Long> {
    Optional<Subscription> findByBusinessId(Long businessId);
    Optional<Subscription> findByLastCheckoutToken(String token);
}
