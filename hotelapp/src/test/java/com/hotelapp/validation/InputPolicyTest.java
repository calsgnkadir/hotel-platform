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
