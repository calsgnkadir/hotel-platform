package com.hotelapp.service;

import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.PasswordResetTokenRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

/** Şifre sıfırlama kayıttaki kuralı uygular (8+ karakter, 1 harf, 1 rakam). */
class PasswordResetServiceTest {

    @Test
    void confirmReset_rejectsPasswordsRegisterWouldReject_beforeTouchingToken() {
        UserRepository users = mock(UserRepository.class);
        PasswordResetTokenRepository tokens = mock(PasswordResetTokenRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        PasswordResetService service = new PasswordResetService(users, tokens, mock(EmailService.class),
                encoder, mock(RefreshTokenService.class));

        String[][] cases = {
                {"OnlyLetters", "error.auth.passwordWeak"},
                {"12345678", "error.auth.passwordWeak"},
                {"Ab1", "error.auth.passwordTooShort"},
        };
        for (String[] c : cases) {
            assertThatThrownBy(() -> service.confirmReset("tok", c[0]))
                    .as(c[0])
                    .isInstanceOf(BusinessRuleException.class)
                    .extracting(e -> ((BusinessRuleException) e).getMessageKey())
                    .isEqualTo(c[1]);
        }
        verifyNoInteractions(tokens, users, encoder);
    }

    @Test
    void confirmReset_rejectsOver72Utf8BytesBeforeTokenOrEncoding() {
        UserRepository users = mock(UserRepository.class);
        PasswordResetTokenRepository tokens = mock(PasswordResetTokenRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        PasswordResetService service = new PasswordResetService(users, tokens, mock(EmailService.class),
                encoder, mock(RefreshTokenService.class));

        assertThatThrownBy(() -> service.confirmReset("tok", "A1" + "a".repeat(71)))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(e -> ((BusinessRuleException) e).getMessageKey())
                .isEqualTo("error.auth.passwordTooLong");
        verifyNoInteractions(tokens, users, encoder);
    }

    @Test
    void confirmReset_acceptsExactly72Utf8BytesAndStoresEncodedValue() {
        UserRepository users = mock(UserRepository.class);
        PasswordResetTokenRepository tokens = mock(PasswordResetTokenRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        RefreshTokenService refresh = mock(RefreshTokenService.class);
        PasswordResetService service = new PasswordResetService(users, tokens, mock(EmailService.class), encoder, refresh);
        var user = com.hotelapp.entity.User.builder().id(42L).email("person@example.test").password("oldhash")
                .role(com.hotelapp.enums.Role.CANDIDATE).build();
        var token = new com.hotelapp.entity.PasswordResetToken();
        token.setToken("synthetic-token");
        token.setUser(user);
        token.setExpiresAt(java.time.LocalDateTime.now().plusMinutes(5));
        when(tokens.findByToken("synthetic-token")).thenReturn(java.util.Optional.of(token));
        when(encoder.encode("A1" + "a".repeat(68) + "é")).thenReturn("newhash");

        service.confirmReset("synthetic-token", "A1" + "a".repeat(68) + "é");

        assertThat(user.getPassword()).isEqualTo("newhash");
        verify(users).save(user);
    }
}
