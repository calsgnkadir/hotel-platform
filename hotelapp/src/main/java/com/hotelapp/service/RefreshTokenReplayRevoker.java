package com.hotelapp.service;

import com.hotelapp.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Commits replay-response revocation independently of the rejected refresh request. */
@Service
@RequiredArgsConstructor
public class RefreshTokenReplayRevoker {

    private final RefreshTokenRepository repo;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void revokeAllForUser(Long userId) {
        repo.revokeAllForUser(userId);
    }
}
