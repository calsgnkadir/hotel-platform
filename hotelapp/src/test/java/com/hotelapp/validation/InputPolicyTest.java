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
}
