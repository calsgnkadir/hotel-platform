package com.hotelapp.security;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

/** Validate production settings before datasource creation or seed runners. */
@Configuration(proxyBeanMethods = false)
@Profile("prod")
public class ProductionSafetyConfiguration {
    @Bean
    static BeanFactoryPostProcessor productionEnvironmentCheck(Environment env) {
        return factory -> {
            if (env.acceptsProfiles(Profiles.of("dev", "demo", "test"))) {
                throw new IllegalStateException("PROD-SAFETY: prod cannot be combined with dev, demo or test. Use a separate demo environment and database.");
            }
            String username = env.getProperty("spring.datasource.username", "").trim();
            if (username.isEmpty() || "root".equalsIgnoreCase(username)) {
                throw new IllegalStateException("PROD-SAFETY: use a dedicated database user, not root (DB_USERNAME).");
            }
            if (!"validate".equals(env.getProperty("spring.jpa.hibernate.ddl-auto"))) {
                throw new IllegalStateException("PROD-SAFETY: production requires JPA_DDL_AUTO=validate; schema changes belong in Flyway.");
            }
            // Kalici VAPID anahtari yoksa her restart'ta yenisi uretilir ve tum push
            // abonelikleri gecersiz olur. Vitrin (showcase) demo oldugu icin muaf.
            if (!env.acceptsProfiles(Profiles.of("showcase"))
                    && (env.getProperty("app.push.vapid.public-key", "").isBlank()
                        || env.getProperty("app.push.vapid.private-key", "").isBlank())) {
                throw new IllegalStateException("PROD-SAFETY: set a persistent VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY pair; otherwise every restart invalidates all push subscriptions.");
            }
            // E-posta olmadan şifre sıfırlama, e-posta doğrulama ve ekip listesi çalışmaz.
            // Resend anahtarları 're_' ile başlar; onboarding@resend.dev yalnızca hesap
            // sahibine gönderir. Vitrin (showcase) demo hesaplarına mail atmasın diye muaf.
            if (!env.acceptsProfiles(Profiles.of("showcase"))) {
                String resendKey = env.getProperty("app.email.resend.api-key", "").trim();
                String resendFrom = env.getProperty("app.email.resend.from", "").trim().toLowerCase();
                if (!resendKey.startsWith("re_")) {
                    throw new IllegalStateException("PROD-SAFETY: set a real RESEND_API_KEY (starts with 're_'); without email, password reset and email verification do not work.");
                }
                if (resendFrom.isEmpty() || resendFrom.endsWith("@resend.dev")) {
                    throw new IllegalStateException("PROD-SAFETY: set RESEND_FROM to an address on your verified domain (e.g. bildirim@kadrom.me); @resend.dev only delivers to the account owner.");
                }
                // iyzico: anahtar yoksa ödeme kapalı (izinli — platform ücretsiz çalışır).
                // Anahtar varsa CANLI olmalı: sandbox'ta iyzico'nun herkese açık test
                // kartıyla bedava abonelik alınır. Callback localhost ise ödeme alınır
                // ama sonuç bize dönmez → abonelik açılmaz.
                String iyzicoKey = env.getProperty("app.iyzico.api-key", "").trim();
                String iyzicoSecret = env.getProperty("app.iyzico.secret-key", "").trim();
                if (!iyzicoKey.isEmpty() || !iyzicoSecret.isEmpty()) {
                    String iyzicoUrl = env.getProperty("app.iyzico.base-url", "").trim().toLowerCase();
                    String callback = env.getProperty("app.iyzico.callback-url", "").trim().toLowerCase();
                    if (iyzicoKey.isEmpty() || iyzicoSecret.isEmpty()) {
                        throw new IllegalStateException("PROD-SAFETY: set both IYZICO_API_KEY and IYZICO_SECRET_KEY, or neither (payments off).");
                    }
                    if (iyzicoUrl.contains("sandbox") || iyzicoKey.startsWith("sandbox-")) {
                        throw new IllegalStateException("PROD-SAFETY: iyzico SANDBOX in production lets anyone subscribe with the public test card. Use live keys and IYZICO_BASE_URL=https://api.iyzipay.com, or leave keys empty (payments off).");
                    }
                    if (!callback.startsWith("https://") || callback.contains("localhost")) {
                        throw new IllegalStateException("PROD-SAFETY: IYZICO_CALLBACK_URL must be the public https URL (e.g. https://api.kadrom.me/api/billing/callback).");
                    }
                }
            }
        };
    }
}
