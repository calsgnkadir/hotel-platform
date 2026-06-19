package com.hotelapp.repository;

import com.hotelapp.entity.ShiftSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ShiftSlotRepository extends JpaRepository<ShiftSlot, Long> {
    List<ShiftSlot> findAllByJobListingId(Long jobListingId);

    /**
     * FAZ G.8 — Platform genelinde "acik kalan" vardiya slot sayisi:
     * tarih bugun veya sonrasi + slotsFilled < slotsNeeded + ilan ACTIVE.
     */
    @org.springframework.data.jpa.repository.Query("""
        SELECT COALESCE(SUM(s.slotsNeeded - s.slotsFilled), 0)
        FROM ShiftSlot s
        WHERE s.jobListing.status = com.hotelapp.enums.ListingStatus.ACTIVE
          AND s.date >= :today
          AND s.slotsFilled < s.slotsNeeded
    """)
    long countOpenSlots(@org.springframework.data.repository.query.Param("today") java.time.LocalDate today);
}
