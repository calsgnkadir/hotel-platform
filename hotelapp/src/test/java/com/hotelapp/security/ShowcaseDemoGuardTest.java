package com.hotelapp.security;

import com.hotelapp.exception.UnauthorizedException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ShowcaseDemoGuardTest {

    private static ShowcaseDemoGuard guard(String... profiles) {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles(profiles);
        return new ShowcaseDemoGuard(env);
    }

    @Test
    void showcase_demoAccountsAreLocked() {
        ShowcaseDemoGuard g = guard("prod", "showcase");
        for (String email : new String[]{"demo-aday1@test.com", "demo-isletme6@test.com", " Demo-Aday3@Test.com "}) {
            assertThatThrownBy(() -> g.requireMutable(email))
                    .as(email)
                    .isInstanceOf(UnauthorizedException.class)
                    .extracting(e -> ((UnauthorizedException) e).getMessageKey())
                    .isEqualTo("error.showcase.demoAccountLocked");
        }
    }

    @Test
    void showcase_realAccountsUnaffected() {
        ShowcaseDemoGuard g = guard("prod", "showcase");
        assertThatCode(() -> g.requireMutable("ziyaretci@example.com")).doesNotThrowAnyException();
        assertThatCode(() -> g.requireMutable("demo-aday1@test.com.evil.example")).doesNotThrowAnyException();
        assertThatCode(() -> g.requireMutable(null)).doesNotThrowAnyException();
    }

    @Test
    void outsideShowcase_demoAccountsMutable() {
        assertThatCode(() -> guard("dev", "demo").requireMutable("demo-aday1@test.com")).doesNotThrowAnyException();
        assertThatCode(() -> guard("prod").requireMutable("demo-aday1@test.com")).doesNotThrowAnyException();
    }
}
