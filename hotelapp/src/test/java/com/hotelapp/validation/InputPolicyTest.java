package com.hotelapp.validation;

import com.hotelapp.exception.BusinessRuleException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Ortak şifre kuralı ve işletme web sitesi şeması. */
class InputPolicyTest {

    @Test
    void passwordPolicy_sameRuleEverywhere() {
        assertThat(PasswordPolicy.violationKey(null)).isEqualTo("error.auth.passwordTooShort");
        assertThat(PasswordPolicy.violationKey("Ab1")).isEqualTo("error.auth.passwordTooShort");
        assertThat(PasswordPolicy.violationKey("OnlyLetters")).isEqualTo("error.auth.passwordWeak");
        assertThat(PasswordPolicy.violationKey("12345678")).isEqualTo("error.auth.passwordWeak");
        assertThat(PasswordPolicy.violationKey("Test1234")).isNull();
    }

    @Test
    void passwordPolicy_enforcesUtf8BytesAtBcryptBoundary() {
        assertThat(PasswordPolicy.violationKey("A1" + "a".repeat(70))).isNull(); // 72 ASCII bytes
        assertThat(PasswordPolicy.violationKey("A1" + "a".repeat(71)))
                .isEqualTo("error.auth.passwordTooLong"); // 73 ASCII bytes
        assertThat(PasswordPolicy.violationKey("A1" + "a".repeat(68) + "é")).isNull(); // 72 UTF-8 bytes
        assertThat(PasswordPolicy.violationKey("A1" + "a".repeat(69) + "é"))
                .isEqualTo("error.auth.passwordTooLong"); // 73 UTF-8 bytes
        assertThat(PasswordPolicy.violationKey("A1" + "a".repeat(66) + "😀")).isNull(); // 72 UTF-8 bytes
        assertThat(PasswordPolicy.violationKey("A1" + "a".repeat(67) + "😀"))
                .isEqualTo("error.auth.passwordTooLong"); // 73 UTF-8 bytes
    }

    @Test
    void springSecurityBcryptRejectsEncodingBeyond72BytesAndPreservesLegacyMatchCompatibility() {
        var encoder = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
        String password72 = "A1" + "a".repeat(70);
        String password73WithDifferentSuffix = "A1" + "a".repeat(70) + "b";
        String encoded = encoder.encode(password72);

        assertThat(encoder.matches(password72, encoded)).isTrue();
        assertThat(encoder.matches("A1" + "a".repeat(69) + "z", encoded)).isFalse();
        assertThatThrownBy(() -> encoder.encode(password73WithDifferentSuffix))
                .isInstanceOf(IllegalArgumentException.class);
        // Spring Security preserves matching behavior for legacy hashes; the app-level
        // login byte guard must reject this input before it reaches matches().
        assertThat(encoder.matches(password73WithDifferentSuffix, encoded)).isTrue();

        String unicode72 = "A1" + "a".repeat(68) + "é";
        String unicode73 = "A1" + "a".repeat(69) + "é";
        String unicodeHash = encoder.encode(unicode72);
        assertThat(encoder.matches(unicode72, unicodeHash)).isTrue();
        assertThatThrownBy(() -> encoder.encode(unicode73))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void passwordByteConstraintAppliesToLoginAndPasswordChangeDtos() {
        var validatorFactory = jakarta.validation.Validation.buildDefaultValidatorFactory();
        try (validatorFactory) {
            var validator = validatorFactory.getValidator();
            var login = new com.hotelapp.dto.LoginRequest();
            login.setEmail("user@example.test");
            login.setPassword("A1" + "a".repeat(71));
            assertThat(validator.validate(login)).anySatisfy(v ->
                    assertThat(v.getMessage()).contains("72 UTF-8"));

            var change = new com.hotelapp.service.AuthService.ChangePasswordRequest();
            change.setCurrentPassword("A1" + "a".repeat(71));
            change.setNewPassword("Test1234");
            assertThat(validator.validate(change)).anySatisfy(v ->
                    assertThat(v.getMessage()).contains("72 UTF-8"));
        }
    }

    @Test
    void website_onlyHttpAndHttps() {
        assertThat(WebsiteUrlPolicy.normalizeOrReject(null)).isNull();
        assertThat(WebsiteUrlPolicy.normalizeOrReject("   ")).isNull();
        assertThat(WebsiteUrlPolicy.normalizeOrReject(" https://www.isletmem.com ")).isEqualTo("https://www.isletmem.com");
        assertThat(WebsiteUrlPolicy.normalizeOrReject("HTTP://isletmem.com/a?b=c")).isEqualTo("HTTP://isletmem.com/a?b=c");

        for (String bad : new String[]{
                "javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<b>x</b>", "vbscript:x",
                "www.isletmem.com", "ftp://isletmem.com", "https://", "https:///yol",
                "https://site.com@kotu.example", "https://isletmem.com/a b", "http://x.com/\u0000a",
                "https://" + "a".repeat(260) + ".com"}) {
            assertThat(WebsiteUrlPolicy.isAllowed(bad)).as(bad).isFalse();
            assertThatThrownBy(() -> WebsiteUrlPolicy.normalizeOrReject(bad))
                    .as(bad)
                    .isInstanceOf(BusinessRuleException.class)
                    .extracting(e -> ((BusinessRuleException) e).getMessageKey())
                    .isEqualTo("error.business.websiteInvalid");
        }
    }

    @Test
    void candidateBirthDate_minimumAge18() {
        var validator = jakarta.validation.Validation.buildDefaultValidatorFactory().getValidator();
        var req = new com.hotelapp.service.CandidateProfileService.ProfileUpdateRequest();
        req.setFullName("Deneme Aday");

        req.setBirthDate(java.time.LocalDate.now().minusYears(17));
        assertThat(validator.validateProperty(req, "birthDate"))
                .extracting(jakarta.validation.ConstraintViolation::getMessage)
                .containsExactly("Yaşınız 18-65 aralığında olmalı");

        req.setBirthDate(java.time.LocalDate.now().minusYears(18));
        assertThat(validator.validateProperty(req, "birthDate")).isEmpty();
    }

    @Test
    void applicationAndReviewText_haveSizeLimits() {
        var validator = jakarta.validation.Validation.buildDefaultValidatorFactory().getValidator();
        var app = new com.hotelapp.dto.ApplicationRequest();
        app.setJobListingId(1L);
        app.setCoverLetter("a".repeat(2000));
        assertThat(validator.validate(app)).isEmpty();
        app.setCoverLetter("a".repeat(2001));
        assertThat(validator.validate(app)).extracting(jakarta.validation.ConstraintViolation::getMessage)
                .containsExactly("Ön yazı en fazla 2000 karakter olabilir");

        var review = new com.hotelapp.dto.ReviewRequest();
        review.setDecision(com.hotelapp.enums.ApplicationStatus.REJECTED);
        review.setNote("n".repeat(255));
        assertThat(validator.validate(review)).isEmpty();
        review.setNote("n".repeat(256));
        assertThat(validator.validate(review)).extracting(jakarta.validation.ConstraintViolation::getMessage)
                .containsExactly("Not en fazla 255 karakter olabilir");
    }
}
