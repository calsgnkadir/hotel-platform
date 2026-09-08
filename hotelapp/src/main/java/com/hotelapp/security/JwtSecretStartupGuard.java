package com.hotelapp.security;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * JWT_SECRET prod'da ZORUNLU + guclu olmali.
 *
 * application.yml'de jwt.secret'in bir DEV fallback default'u var
 * (dev-only-secret-key-...). Bu dev'de rahatlik saglar ama prod'da JWT_SECRET
 * env verilmezse uygulama bu HERKESCE BILINEN anahtarla ayaga kalkar →
 * saldirgan istedigi rolde (admin dahil) token uretebilir. Kritik acik.
 *
 * Bu guard yalnizca "prod" profilinde calisir: secret bos, dev-default'a esit
 * ya da 32 karakterden kisa ise uygulamayi ACMAZ. dev/demo/test'te no-op.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JwtSecretStartupGuard {

    /** application.yml'deki dev fallback — prod'da bu deger KABUL EDILMEZ. */
    private static final String DEV_DEFAULT = "dev-only-secret-key-at-least-32-characters-long-!!!";

    private final Environment environment;

    @Value("${jwt.secret:}")
    private String jwtSecret;

    @PostConstruct
    void enforceInProd() {
        boolean prod = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (!prod) return;

        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException(
                "JWT_SECRET prod profilinde ZORUNLU — verilmezse token'lar forge edilebilir. "
                + "Uret: `openssl rand -base64 48` ve env var olarak ver.");
        }
        if (DEV_DEFAULT.equals(jwtSecret.trim())) {
            throw new IllegalStateException(
                "JWT_SECRET prod'da DEV fallback anahtariyla ayni — bu herkesce bilinir. "
                + "Gercek bir anahtar ver: `openssl rand -base64 48`.");
        }
        if (jwtSecret.trim().length() < 32) {
            throw new IllegalStateException(
                "JWT_SECRET cok kisa (" + jwtSecret.trim().length() + " karakter) — en az 32 olmali. "
                + "Uret: `openssl rand -base64 48`.");
        }
        log.info("[JWT-GUARD] prod profili + guclu JWT_SECRET — OK");
    }
}
