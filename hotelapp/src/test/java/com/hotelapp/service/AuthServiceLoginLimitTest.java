package com.hotelapp.service;

import com.hotelapp.dto.LoginRequest;
import com.hotelapp.exception.TooManyRequestsException;
import com.hotelapp.security.LoginAttemptLimiter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** E-posta basina giris denemesi siniri: 10 yanlis denemeden sonra 429, kimlik dogrulama cagrilmaz. */
@ExtendWith(MockitoExtension.class)
class AuthServiceLoginLimitTest {

    @Mock private AuthenticationManager authenticationManager;
    @Spy private LoginAttemptLimiter loginAttemptLimiter = new LoginAttemptLimiter();
    @InjectMocks private AuthService authService;

    @Test
    @DisplayName("11. yanlis deneme 429 (TooManyRequests) ve parola kontrolune ulasmaz")
    void eleventhFailedAttempt_isThrottled() {
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("bad"));
        LoginRequest req = new LoginRequest();
        req.setEmail("kurban@test.com");
        req.setPassword("yanlis-parola");

        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> authService.login(req)).isInstanceOf(BadCredentialsException.class);
        }
        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessageContaining("çok fazla giriş denemesi");
        verify(authenticationManager, times(10)).authenticate(any());
    }
}
