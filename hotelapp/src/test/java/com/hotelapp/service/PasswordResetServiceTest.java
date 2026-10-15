package com.hotelapp.service;

import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.PasswordResetTokenRepository;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

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
}
