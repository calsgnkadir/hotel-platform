package com.hotelapp.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LoginAttemptLimiterTest {

    private static final String IP = "203.0.113.5";

    @Test
    @DisplayName("Ayni e-posta+IP icin 10 deneme gecer, 11. reddedilir (buyuk/kucuk harf ve bosluk ayni anahtar)")
    void eleventhAttempt_isRejected_caseInsensitive() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter();
        for (int i = 0; i < LoginAttemptLimiter.MAX_ATTEMPTS; i++) {
            String email = (i % 2 == 0) ? "Hedef@Test.com" : "  hedef@test.com ";
            assertThat(limiter.tryAcquire(email, IP)).isTrue();
        }
        assertThat(limiter.tryAcquire("hedef@test.com", IP)).isFalse();
        // Baska hesap etkilenmez
        assertThat(limiter.tryAcquire("baska@test.com", IP)).isTrue();
    }

    @Test
    @DisplayName("Bir IP'nin tukettigi kova ayni e-postayi baska IP'de kilitlemez")
    void exhaustedIp_doesNotLockOtherIp() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter();
        for (int i = 0; i < LoginAttemptLimiter.MAX_ATTEMPTS; i++) limiter.tryAcquire("hedef@test.com", "198.51.100.66");
        assertThat(limiter.tryAcquire("hedef@test.com", "198.51.100.66")).isFalse();
        assertThat(limiter.tryAcquire("hedef@test.com", IP)).isTrue();
    }

    @Test
    @DisplayName("Basarili giris sayaci sifirlar")
    void reset_clearsCounter() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter();
        for (int i = 0; i < LoginAttemptLimiter.MAX_ATTEMPTS; i++) limiter.tryAcquire("a@test.com", IP);
        assertThat(limiter.tryAcquire("a@test.com", IP)).isFalse();
        limiter.reset("A@test.com", IP);
        assertThat(limiter.tryAcquire("a@test.com", IP)).isTrue();
    }

    @Test
    @DisplayName("Bos/null e-posta kova acmaz")
    void blankEmail_noBucket() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter();
        assertThat(limiter.tryAcquire(null, IP)).isTrue();
        assertThat(limiter.tryAcquire("   ", IP)).isTrue();
        assertThat(limiter.size()).isZero();
    }

    @Test
    @DisplayName("Dagitik deneme esigi pencere basina bir kez uyarir, kilitlemez")
    void globalThreshold_alertsOnce() {
        LoginAttemptLimiter limiter = new LoginAttemptLimiter();
        for (int i = 0; i < LoginAttemptLimiter.GLOBAL_ALERT_THRESHOLD; i++) {
            assertThat(limiter.recordFailure("hedef@test.com")).isFalse();
        }
        assertThat(limiter.recordFailure("Hedef@test.com")).isTrue();
        assertThat(limiter.recordFailure("hedef@test.com")).isFalse();
        // Kilit kovasi etkilenmez
        assertThat(limiter.tryAcquire("hedef@test.com", IP)).isTrue();
    }

    @Test
    @DisplayName("Log maskeleme e-postayi acik yazmaz")
    void mask_hidesLocalPart() {
        assertThat(LoginAttemptLimiter.mask("hedef@test.com")).isEqualTo("h***@test.com");
        assertThat(LoginAttemptLimiter.mask("bozuk")).isEqualTo("***");
    }
}
