package com.hotelapp.integration;

import com.hotelapp.entity.RefreshToken;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.RefreshTokenRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.service.AuthService;
import com.hotelapp.service.RefreshTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Proves reuse detection commits account-wide revocation despite the 401 response. */
@SpringBootTest
@ActiveProfiles("test")
class RefreshTokenReplayIT {

    @Autowired private AuthService authService;
    @Autowired private RefreshTokenService refreshTokenService;
    @Autowired private UserRepository userRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;

    @Test
    void replayRevokesAllTokensAndPersistsAfterUnauthorizedResponse() {
        User user = userRepository.save(User.builder()
                .email("refresh-replay-" + System.nanoTime() + "@test.com")
                .fullName("Refresh Replay")
                .role(Role.CANDIDATE)
                .build());

        String originalToken = refreshTokenService.createForUser(user);
        String activeToken = refreshTokenService.validateAndRotate(originalToken).newRawRefreshToken();

        assertThatThrownBy(() -> authService.refresh(originalToken))
                .isInstanceOf(UnauthorizedException.class);

        // Re-query after AuthService.refresh has rolled back its request transaction.
        var persistedTokens = refreshTokenRepository.findAllByUser_Id(user.getId());
        assertThat(persistedTokens).hasSize(2)
                .allMatch(RefreshToken::isRevoked);

        assertThatThrownBy(() -> authService.refresh(activeToken))
                .isInstanceOf(UnauthorizedException.class);
    }
}
