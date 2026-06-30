package com.hotelapp.repository;

import com.hotelapp.entity.SavedSearch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SavedSearchRepository extends JpaRepository<SavedSearch, Long> {

    List<SavedSearch> findByUser_IdOrderByCreatedAtDesc(Long userId);

    long countByUser_Id(Long userId);

    @Query("SELECT s FROM SavedSearch s WHERE s.notificationsEnabled = true")
    List<SavedSearch> findAllEnabled();
}
