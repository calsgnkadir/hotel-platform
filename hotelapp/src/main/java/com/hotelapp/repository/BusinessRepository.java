package com.hotelapp.repository;

import com.hotelapp.entity.Business;
import com.hotelapp.enums.BusinessType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BusinessRepository extends JpaRepository<Business, Long> {
    Optional<Business> findByOwnerId(Long ownerId);
    List<Business> findAllByType(BusinessType type);
    boolean existsByOwnerId(Long ownerId);
}
