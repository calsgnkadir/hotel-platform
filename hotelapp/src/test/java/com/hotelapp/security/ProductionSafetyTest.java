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
                        "app.email.resend.api-key=re_test_only", "app.email.resend.from=bildirim@kadrom.me");
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
