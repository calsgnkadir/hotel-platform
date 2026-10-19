package com.hotelapp.security;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProductionSafetyTest {
    private ApplicationContextRunner context(String... profiles) {
        return new ApplicationContextRunner()
                .withUserConfiguration(ProductionSafetyConfiguration.class)
                .withInitializer(ctx -> ctx.getEnvironment().setActiveProfiles(profiles))
                .withPropertyValues("spring.datasource.username=kadrom_app", "spring.jpa.hibernate.ddl-auto=validate",
                        "app.push.vapid.public-key=test-public", "app.push.vapid.private-key=test-private",
                        "app.email.resend.api-key=re_test_only", "app.email.resend.from=bildirim@kadrom.me",
                        "app.security.cookie-secure=true", "app.base-url=https://kadrom.me",
                        "cloudinary.url=cloudinary://key:secret@kadrom-cloud",
                        "app.cors.allowed-origins=https://kadrom.me, https://www.kadrom.me");
    }

    @Test void productionRequiresSecureCookie() {
        context("prod").withPropertyValues("app.security.cookie-secure=false")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("COOKIE_SECURE"));
        context("prod").withPropertyValues("app.security.cookie-secure=")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("COOKIE_SECURE"));
    }

    @Test void productionRequiresPublicHttpsBaseUrl() {
        for (String url : new String[]{"http://kadrom.me", "https://localhost:5173", "http://localhost:5173",
                "https://127.0.0.1", ""}) {
            context("prod").withPropertyValues("app.base-url=" + url)
                    .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("APP_BASE_URL"));
        }
    }

    @Test void productionRejectsTestCloudinary() {
        context("prod").withPropertyValues("cloudinary.url=cloudinary://test:test@test")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("CLOUDINARY_URL"));
    }

    @Test void productionRejectsLocalhostOrWildcardCors() {
        for (String cors : new String[]{"https://kadrom.me,http://localhost:5173", "*",
                "https://kadrom.me, https://*.vercel.app", " http://127.0.0.1:3000 "}) {
            context("prod").withPropertyValues("app.cors.allowed-origins=" + cors)
                    .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("APP_CORS_ALLOWED_ORIGINS"));
        }
    }

    @Test void productionRequiresVerifiedEmailGate() {
        context("prod").withPropertyValues("app.auth.require-verified-email=false")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("require-verified-email"));
    }

    @Test void showcaseIsExemptFromPublicDeploymentChecks() {
        context("prod", "showcase").withPropertyValues("app.security.cookie-secure=false",
                        "app.base-url=http://localhost:5173", "cloudinary.url=cloudinary://test:test@test",
                        "app.cors.allowed-origins=http://localhost:5173")
                .run(ctx -> assertThat(ctx).hasNotFailed());
    }

    @Test void corsListIsTrimmed() {
        assertThat(com.hotelapp.config.SecurityConfig.parseOrigins(" https://a.example , https://b.example ,, "))
                .containsExactly("https://a.example", "https://b.example");
        assertThat(com.hotelapp.config.SecurityConfig.parseOrigins(null)).isEmpty();
    }

    @Test void productionRequiresRealEmailSetup() {
        context("prod").withPropertyValues("app.email.resend.api-key=test-key")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("RESEND_API_KEY"));
        context("prod").withPropertyValues("app.email.resend.api-key=")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("RESEND_API_KEY"));
        context("prod").withPropertyValues("app.email.resend.from=onboarding@resend.dev")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("RESEND_FROM"));
        // Vitrin muaf: demo hesaplarına (gerçek olmayan adresler) mail gitmesin
        context("prod", "showcase").withPropertyValues("app.email.resend.api-key=test-key",
                        "app.email.resend.from=onboarding@resend.dev")
                .run(ctx -> assertThat(ctx).hasNotFailed());
    }

    @Test void productionRequiresPersistentVapidKeys() {
        context("prod").withPropertyValues("app.push.vapid.private-key=")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("VAPID"));
        context("prod").withPropertyValues("app.push.vapid.public-key=")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("VAPID"));
        // Vitrin muaf: anahtar olmadan da acilir
        context("prod", "showcase").withPropertyValues("app.push.vapid.public-key=", "app.push.vapid.private-key=")
                .run(ctx -> assertThat(ctx).hasNotFailed());
    }

    @Test void productionRejectsSandboxOrHalfConfiguredPayments() {
        String live = "app.iyzico.api-key=live-test-placeholder";
        String liveSecret = "app.iyzico.secret-key=live-secret-placeholder";
        String liveUrl = "app.iyzico.base-url=https://api.iyzipay.com";
        String httpsCallback = "app.iyzico.callback-url=https://api.kadrom.me/api/billing/callback";
        // Anahtar yok = ödeme kapalı → izinli
        context("prod").withPropertyValues("app.iyzico.api-key=", "app.iyzico.secret-key=")
                .run(ctx -> assertThat(ctx).hasNotFailed());
        // Canlı anahtar + canlı adres + https callback → izinli
        context("prod").withPropertyValues(live, liveSecret, liveUrl, httpsCallback)
                .run(ctx -> assertThat(ctx).hasNotFailed());
        // Sandbox adresi
        context("prod").withPropertyValues(live, liveSecret, httpsCallback,
                        "app.iyzico.base-url=https://sandbox-api.iyzipay.com")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("SANDBOX"));
        // Sandbox anahtarı
        context("prod").withPropertyValues("app.iyzico.api-key=sandbox-placeholder", liveSecret, liveUrl, httpsCallback)
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("SANDBOX"));
        // Yarım ayar
        context("prod").withPropertyValues(live, "app.iyzico.secret-key=", liveUrl, httpsCallback)
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("IYZICO_SECRET_KEY"));
        // localhost / http callback
        context("prod").withPropertyValues(live, liveSecret, liveUrl,
                        "app.iyzico.callback-url=http://localhost:8080/api/billing/callback")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("IYZICO_CALLBACK_URL"));
        // Vitrin muaf: demo'da sandbox ödeme denenebilir
        context("prod", "showcase").withPropertyValues("app.iyzico.api-key=sandbox-placeholder", liveSecret,
                        "app.iyzico.base-url=https://sandbox-api.iyzipay.com", httpsCallback)
                .run(ctx -> assertThat(ctx).hasNotFailed());
    }

    @Test void isolatedProductionStarts() {
        context("prod").run(ctx -> assertThat(ctx).hasNotFailed());
    }
    @Test void demoDevelopmentAndTestCannotBeCombinedWithProduction() {
        for (String profile : new String[]{"dev", "demo", "test"}) {
            context("prod", profile).run(ctx -> assertThat(ctx.getStartupFailure())
                    .hasMessageContaining("prod cannot be combined"));
        }
    }
    @Test void databaseRootAndImplicitDdlAreRejected() {
        context("prod").withPropertyValues("spring.datasource.username=root")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("dedicated database user"));
        context("prod").withPropertyValues("spring.jpa.hibernate.ddl-auto=update")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("JPA_DDL_AUTO=validate"));
    }
    @Test void showcaseKeepsProductionChecks() {
        // Vitrin: prod korumaları açık, demo verisine izin var
        context("prod", "showcase").run(ctx -> assertThat(ctx).hasNotFailed());
        context("prod", "showcase").withPropertyValues("spring.datasource.username=root")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("dedicated database user"));
        context("prod", "showcase", "demo")
                .run(ctx -> assertThat(ctx.getStartupFailure()).hasMessageContaining("prod cannot be combined"));
    }

    @Test void localDemoIsUnaffected() {
        context("dev", "demo").withPropertyValues("spring.datasource.username=root", "spring.jpa.hibernate.ddl-auto=update")
                .run(ctx -> assertThat(ctx).hasNotFailed());
    }
    @Test void existingDemoDataBlocksProductionWithoutDeletingAnything() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class))).thenReturn(1L);
        assertThatThrownBy(() -> new ProductionDemoDataGuard(jdbc).verifyNoDemoAccounts())
                .hasMessageContaining("No records were deleted");
        verify(jdbc).queryForObject(anyString(), eq(Long.class));
        verifyNoMoreInteractions(jdbc);
    }
    @Test void emptyProductionDatabasePassesDataCheck() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Long.class))).thenReturn(0L);
        assertThatCode(() -> new ProductionDemoDataGuard(jdbc).verifyNoDemoAccounts()).doesNotThrowAnyException();
    }
}
