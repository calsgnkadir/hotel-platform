package com.hotelapp.security;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * FAZ H.4 guard — APP_ENCRYPTION_KEY prod'da ZORUNLU.
 *
 * EncryptionService key bos oldugunda sessizce DEVRE DISI kaliyor (dev/test icin
 * dogru). Ama prod'da bu, hassas belge alanlarinin (adli sicil / saglik raporu /
 * kimlik Cloudinary yolu + orijinal dosya adi) DB'de PLAIN-TEXT yazilmasi demek
 * — KVKK m.12 special-category veri ihlali riski.
 *
 * Bu guard yalnizca "prod" profili aktifken calisir: key yoksa uygulamanin
 * ACILMASINI engeller. Boylece prod asla kazayla sifresiz PII ile ayaga kalkmaz.
 * dev/demo/test profillerinde no-op.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EncryptionStartupGuard {

    private final Environment environment;

    @Value("${app.encryption.key:}")
    private String encryptionKey;

    @PostConstruct
    void enforceInProd() {
        boolean prod = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        if (!prod) return;
        if (encryptionKey == null || encryptionKey.isBlank()) {
            throw new IllegalStateException(
                "APP_ENCRYPTION_KEY prod profilinde ZORUNLU — hassas belge alanlari (KVKK m.12) "
                + "aksi halde DB'de sifresiz saklanir. Uret: `openssl rand -base64 32` ve env var olarak ver.");
        }
        log.info("[ENCRYPTION-GUARD] prod profili + APP_ENCRYPTION_KEY set — OK");
    }
}
