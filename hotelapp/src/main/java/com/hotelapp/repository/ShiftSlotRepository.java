package com.hotelapp.repository;

import com.hotelapp.entity.ShiftSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ShiftSlotRepository extends JpaRepository<ShiftSlot, Long> {
    List<ShiftSlot> findAllByJobListingId(Long jobListingId);

    /**
     * Kapasite yarisina karsi kosullu atomik artirma: iki kabul ayni anda son
     * koltugu almaya calisirsa yalniz biri 1 satir gunceller. 0 donerse slot dolu.
     * Bellekteki ShiftSlot nesnesine dokunulmaz (DynamicUpdate ile bayat deger
     * geri yazilmaz).
     */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query(
        "UPDATE ShiftSlot s SET s.slotsFilled = s.slotsFilled + 1 WHERE s.id = :id AND s.slotsFilled < s.slotsNeeded")
    int incrementFilledIfAvailable(@org.springframework.data.repository.query.Param("id") Long id);

    /** Koltugu atomik bosaltir; sayac 0'in altina inmez. */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying(flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query(
        "UPDATE ShiftSlot s SET s.slotsFilled = s.slotsFilled - 1 WHERE s.id = :id AND s.slotsFilled > 0")
    int decrementFilled(@org.springframework.data.repository.query.Param("id") Long id);

    /** Akşam ekip listesi: o gün vardiyası olan ilanlar. */
    @org.springframework.data.jpa.repository.Query(
        "SELECT DISTINCT s.jobListing.id FROM ShiftSlot s WHERE s.date = :date")
    List<Long> findListingIdsWithSlotOn(@org.springframework.data.repository.query.Param("date") java.time.LocalDate date);

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
