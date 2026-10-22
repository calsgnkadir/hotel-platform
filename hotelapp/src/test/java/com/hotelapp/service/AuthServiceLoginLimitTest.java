package com.hotelapp.service;

import com.hotelapp.dto.AuthResponse;
import com.hotelapp.dto.LoginRequest;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.TooManyRequestsException;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.security.JwtService;
import com.hotelapp.security.LoginAttemptLimiter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Giris denemesi siniri (e-posta + IP): 10 yanlis denemeden sonra ayni IP 429 alir,
 * baska IP'deki gercek kullanici etkilenmez; dogru parolali girisler kovayi tuketmez.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceLoginLimitTest {

    private static final String EMAIL = "kurban@test.com";
    private static final String GOOD = "dogru-parola";
    private static final String ATTACKER_IP = "198.51.100.66";
    private static final String USER_IP = "203.0.113.5";

    @Mock private AuthenticationManager authenticationManager;
    @Mock private UserRepository userRepository;
    @Mock private JwtService jwtService;
    @Mock private RefreshTokenService refreshTokenService;
    @Spy private LoginAttemptLimiter loginAttemptLimiter = new LoginAttemptLimiter();
    @InjectMocks private AuthService authService;

    /** Parola GOOD ise dogrular, aksi halde BadCredentials. */
    private void stubAuth() {
        when(authenticationManager.authenticate(any())).thenAnswer(inv -> {
            UsernamePasswordAuthenticationToken t = inv.getArgument(0);
            if (GOOD.equals(t.getCredentials())) return (Authentication) t;
            throw new BadCredentialsException("bad");
        });
        User user = User.builder().id(1L).email(EMAIL).fullName("Kurban").role(Role.CANDIDATE).build();
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(jwtService.generateToken(any(User.class))).thenReturn("jwt");
        when(refreshTokenService.createForUser(any())).thenReturn("rt");
    }

    private static LoginRequest req(String password) {
        LoginRequest r = new LoginRequest();
        r.setEmail(EMAIL);
        r.setPassword(password);
        return r;
    }

    @Test
    @DisplayName("Ayni e-posta+IP: 11. yanlis deneme 429 ve parola kontrolune ulasmaz")
    void eleventhFailedAttempt_isThrottled() {
        stubAuth();
        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> authService.login(req("yanlis"), ATTACKER_IP))
                    .isInstanceOf(BadCredentialsException.class);
        }
        assertThatThrownBy(() -> authService.login(req("yanlis"), ATTACKER_IP))
                .isInstanceOf(TooManyRequestsException.class)
                .hasMessage("Bu hesap için çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.");
        // Ayni IP'den dogru parola da kilitli (kova bos)
        assertThatThrownBy(() -> authService.login(req(GOOD), ATTACKER_IP))
                .isInstanceOf(TooManyRequestsException.class);
        verify(authenticationManager, times(10)).authenticate(any());
    }

    @Test
    @DisplayName("Saldirganin 10 yanlis denemesi baska IP'deki gercek kullaniciyi kilitlemez")
    void attackerIp_doesNotLockRealUser() {
        stubAuth();
        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> authService.login(req("yanlis"), ATTACKER_IP))
                    .isInstanceOf(BadCredentialsException.class);
        }
        AuthResponse ok = authService.login(req(GOOD), USER_IP);
        assertThat(ok.getToken()).isEqualTo("jwt");
        // Saldirgan IP'si hala kilitli
        assertThatThrownBy(() -> authService.login(req(GOOD), ATTACKER_IP))
                .isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    @DisplayName("Basarili giris sayaci sifirlar: 9 yanlis + dogru, ardindan yine 10 yanlis hakki")
    void successfulLogin_resetsCounter() {
        stubAuth();
        for (int i = 0; i < 9; i++) {
            assertThatThrownBy(() -> authService.login(req("yanlis"), USER_IP))
                    .isInstanceOf(BadCredentialsException.class);
        }
        authService.login(req(GOOD), USER_IP);
        for (int i = 0; i < 10; i++) {
            assertThatThrownBy(() -> authService.login(req("yanlis"), USER_IP))
                    .isInstanceOf(BadCredentialsException.class);
        }
        assertThatThrownBy(() -> authService.login(req("yanlis"), USER_IP))
                .isInstanceOf(TooManyRequestsException.class);
    }

    @Test
    @DisplayName("Dogru parolali girisler kovayi tuketmez")
    void successfulLogins_doNotConsume() {
        stubAuth();
        for (int i = 0; i < 25; i++) {
            assertThat(authService.login(req(GOOD), USER_IP).getToken()).isEqualTo("jwt");
        }
        verify(loginAttemptLimiter, times(0)).recordFailure(any());
    }

    @Test
    @DisplayName("Basarisiz giris dagitik deneme sayacina islenir")
    void failedLogin_recordsGlobalFailure() {
        stubAuth();
        assertThatThrownBy(() -> authService.login(req("yanlis"), USER_IP))
                .isInstanceOf(BadCredentialsException.class);
        verify(loginAttemptLimiter).recordFailure(EMAIL);
    }

    @Test
    @DisplayName("72 bayti aşan login girdisi auth manager'a ulaşmaz ve 4xx iş kuralı verir")
    void overlongPassword_isRejectedBeforeAuthentication() {
        assertThatThrownBy(() -> authService.login(req("A1" + "a".repeat(71)), USER_IP))
                .isInstanceOf(com.hotelapp.exception.BusinessRuleException.class)
                .extracting(e -> ((com.hotelapp.exception.BusinessRuleException) e).getMessageKey())
                .isEqualTo("error.auth.passwordTooLong");
        verify(authenticationManager, org.mockito.Mockito.never()).authenticate(any());
        verify(loginAttemptLimiter, org.mockito.Mockito.never()).tryAcquire(EMAIL, USER_IP);
    }
}
