package com.hotelapp.service;

import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.SavedListing;
import com.hotelapp.entity.User;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.SavedListingRepository;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Dalga H1 — Aday'in favori (saved) ilanlari servisi.
 * Toggle pattern: save = idempotent (ayni ilana 2. kez post -> sessiz),
 * unsave = silme.
 */
@Service
@RequiredArgsConstructor
public class SavedListingService {

    private final SavedListingRepository savedListingRepository;
    private final JobListingRepository jobListingRepository;
    private final UserRepository userRepository;

    @Transactional
    public void save(Long userId, Long listingId) {
        if (savedListingRepository.existsByUserIdAndJobListingId(userId, listingId)) {
            return;  // idempotent
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", userId));
        JobListing listing = jobListingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("İlan", listingId));

        savedListingRepository.save(SavedListing.builder()
                .user(user)
                .jobListing(listing)
                .build());
    }

    @Transactional
    public void unsave(Long userId, Long listingId) {
        savedListingRepository.deleteByUserIdAndJobListingId(userId, listingId);
    }

    @Transactional(readOnly = true)
    public List<JobListing> getMySavedListings(Long userId) {
        return savedListingRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(SavedListing::getJobListing)
                .toList();
    }

    @Transactional(readOnly = true)
    public java.util.Set<Long> getSavedListingIds(Long userId) {
        return savedListingRepository.findJobListingIdsByUserId(userId);
    }

    @Transactional(readOnly = true)
    public long countMy(Long userId) {
        return savedListingRepository.countByUserId(userId);
    }
}
