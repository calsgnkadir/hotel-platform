package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.BusinessBlock;
import com.hotelapp.entity.BusinessFollow;
import com.hotelapp.entity.User;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.BusinessBlockRepository;
import com.hotelapp.repository.BusinessFollowRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/**
 * Dalga I1 — Aday-Isletme iliskileri (Takip / Engelle)
 *
 * Pattern: toggle / idempotent. Takip + engelle birlikte tutulmaz —
 * bir isletmeyi engellersen takipten dustugun varsayilir.
 */
@Service
@RequiredArgsConstructor
public class BusinessRelationService {

    private final BusinessFollowRepository followRepository;
    private final BusinessBlockRepository blockRepository;
    private final BusinessRepository businessRepository;
    private final UserRepository userRepository;

    // -------- FOLLOW --------

    @Transactional
    public void follow(Long userId, Long businessId) {
        if (followRepository.existsByUserIdAndBusinessId(userId, businessId)) return;
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", userId));
        Business business = businessRepository.findById(businessId)
                .orElseThrow(() -> new ResourceNotFoundException("İşletme", businessId));

        // Engellediyse, takip etmeden once engeli kaldir
        blockRepository.deleteByUserIdAndBusinessId(userId, businessId);

        followRepository.save(BusinessFollow.builder()
                .user(user)
                .business(business)
                .build());
    }

    @Transactional
    public void unfollow(Long userId, Long businessId) {
        followRepository.deleteByUserIdAndBusinessId(userId, businessId);
    }

    @Transactional(readOnly = true)
    public List<Business> getMyFollowing(Long userId) {
        return followRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(BusinessFollow::getBusiness).toList();
    }

    @Transactional(readOnly = true)
    public Set<Long> getFollowingIds(Long userId) {
        return followRepository.findBusinessIdsByUserId(userId);
    }

    // -------- BLOCK --------

    @Transactional
    public void block(Long userId, Long businessId) {
        if (blockRepository.existsByUserIdAndBusinessId(userId, businessId)) return;
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", userId));
        Business business = businessRepository.findById(businessId)
                .orElseThrow(() -> new ResourceNotFoundException("İşletme", businessId));

        // Takip ediyorsa engele gecince takipten dus
        followRepository.deleteByUserIdAndBusinessId(userId, businessId);

        blockRepository.save(BusinessBlock.builder()
                .user(user)
                .business(business)
                .build());
    }

    @Transactional
    public void unblock(Long userId, Long businessId) {
        blockRepository.deleteByUserIdAndBusinessId(userId, businessId);
    }

    @Transactional(readOnly = true)
    public List<Business> getMyBlocked(Long userId) {
        return blockRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(BusinessBlock::getBusiness).toList();
    }

    @Transactional(readOnly = true)
    public Set<Long> getBlockedIds(Long userId) {
        return blockRepository.findBusinessIdsByUserId(userId);
    }

    // -------- STATS --------

    @Transactional(readOnly = true)
    public RelationStats getStats(Long userId) {
        return new RelationStats(
                followRepository.countByUserId(userId),
                blockRepository.countByUserId(userId)
        );
    }

    public record RelationStats(long followingCount, long blockedCount) {}
}
