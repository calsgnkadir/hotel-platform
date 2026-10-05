package com.hotelapp.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceLogoutTest {

    @Mock private RefreshTokenService refreshTokenService;
    @Mock private PushSubscriptionService pushSubscriptionService;
    @InjectMocks private AuthService authService;

    private static final String ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

    @Test
    @DisplayName("Cikis: gecerli refresh token'in sahibine ait bu cihazin push aboneligi koparilir")
    void logout_detachesPushOfTokenOwner() {
        when(refreshTokenService.revoke("raw")).thenReturn(Optional.of(42L));

        authService.logout("raw", ENDPOINT);

        verify(pushSubscriptionService).unsubscribe(42L, ENDPOINT);
    }

    @Test
    @DisplayName("Cikis: token gecersizse kimsenin aboneligine dokunulmaz")
    void logout_invalidToken_noPushChange() {
        when(refreshTokenService.revoke("raw")).thenReturn(Optional.empty());

        authService.logout("raw", ENDPOINT);

        verify(pushSubscriptionService, never()).unsubscribe(any(), any());
    }
}
