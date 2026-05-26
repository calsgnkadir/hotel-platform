package com.hotelapp.repository;

import com.hotelapp.entity.ShiftSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ShiftSlotRepository extends JpaRepository<ShiftSlot, Long> {
    List<ShiftSlot> findAllByJobListingId(Long jobListingId);
}
