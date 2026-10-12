package com.hotelapp.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LoginAttemptLimiterTest {

    @Test
    @DisplayName("Ayni e-posta icin 10 deneme gecer, 11. reddedilir (buyuk/kucuk harf ve bosluk ayni anahtar)")
    void eleventhAttempt_isRejected_caseInsensitive() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter();
        for (int i = 0; i < LoginAttemptLimiter.MAX_ATTEMPTS; i++) {
            String email = (i % 2 == 0) ? "Hedef@Test.com" : "  hedef@test.com ";
            assertThat(limiter.tryAcquire(email)).isTrue();
        }
        assertThat(limiter.tryAcquire("hedef@test.com")).isFalse();
        // Baska hesap etkilenmez
        assertThat(limiter.tryAcquire("baska@test.com")).isTrue();
    }

    @Test
    @DisplayName("Basarili giris sayaci sifirlar")
    void reset_clearsCounter() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter();
        for (int i = 0; i < LoginAttemptLimiter.MAX_ATTEMPTS; i++) limiter.tryAcquire("a@test.com");
        assertThat(limiter.tryAcquire("a@test.com")).isFalse();
        limiter.reset("A@test.com");
        assertThat(limiter.tryAcquire("a@test.com")).isTrue();
    }

    @Test
    @DisplayName("Bos/null e-posta kova acmaz")
    void blankEmail_noBucket() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter();
        assertThat(limiter.tryAcquire(null)).isTrue();
        assertThat(limiter.tryAcquire("   ")).isTrue();
        assertThat(limiter.size()).isZero();
    }
}
