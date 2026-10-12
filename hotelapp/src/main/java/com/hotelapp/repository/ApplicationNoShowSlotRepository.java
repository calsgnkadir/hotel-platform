package com.hotelapp.repository;

import com.hotelapp.entity.ApplicationNoShowSlot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApplicationNoShowSlotRepository extends JpaRepository<ApplicationNoShowSlot, Long> {

    boolean existsByApplicationIdAndShiftSlotId(Long applicationId, Long shiftSlotId);

    long countByApplicationId(Long applicationId);
}
