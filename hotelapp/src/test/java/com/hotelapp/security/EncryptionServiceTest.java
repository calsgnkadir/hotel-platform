package com.hotelapp.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * FAZ H.4 — Field encryption roundtrip + legacy + bozuk veri davranışları.
 */
class EncryptionServiceTest {

    private static final String KEY = Base64.getEncoder().encodeToString(new byte[32]); // 256-bit test key

    @Test
    @DisplayName("encrypt + decrypt roundtrip — plain geri gelir")
    void roundtrip() {
        var svc = new EncryptionService(KEY);
        String plain = "cloudinary/documents/tckn1234/saglik-raporu.pdf";

        String enc = svc.encrypt(plain);
        assertThat(enc).startsWith(EncryptionService.PREFIX);
        assertThat(enc).isNotEqualTo(plain);

        String back = svc.decrypt(enc);
        assertThat(back).isEqualTo(plain);
    }

    @Test
    @DisplayName("Aynı plain iki kez encrypt edilirse farklı ciphertext üretir (IV randomize)")
    void uniqueIv() {
        var svc = new EncryptionService(KEY);
        String e1 = svc.encrypt("aynı veri");
        String e2 = svc.encrypt("aynı veri");
        assertThat(e1).isNotEqualTo(e2);
        assertThat(svc.decrypt(e1)).isEqualTo("aynı veri");
        assertThat(svc.decrypt(e2)).isEqualTo("aynı veri");
    }

    @Test
    @DisplayName("Legacy plain (prefix yok) — decrypt olduğu gibi döner")
    void legacyPlainPassthrough() {
        var svc = new EncryptionService(KEY);
        String legacy = "cloudinary/old/path.pdf";
        assertThat(svc.decrypt(legacy)).isEqualTo(legacy);
    }

    @Test
    @DisplayName("Zaten enc1: prefixli değer tekrar encrypt edilmez")
    void noReEncrypt() {
        var svc = new EncryptionService(KEY);
        String enc = svc.encrypt("data");
        assertThat(svc.encrypt(enc)).isEqualTo(enc);
    }

    @Test
    @DisplayName("Boş key — service DEVRE DIŞI, encrypt no-op")
    void disabledKey_noop() {
        var svc = new EncryptionService("");
        String plain = "test";
        assertThat(svc.encrypt(plain)).isEqualTo(plain);
        assertThat(svc.decrypt(plain)).isEqualTo(plain);
    }

    @Test
    @DisplayName("Disabled service + sifreli okuma -> IllegalStateException")
    void disabledKey_readingEncryptedFails() {
        var svc = new EncryptionService("");
        String stored = EncryptionService.PREFIX + "AAAA";
        assertThatThrownBy(() -> svc.decrypt(stored))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("APP_ENCRYPTION_KEY");
    }

    @Test
    @DisplayName("Bozuk base64 key — ctor throws")
    void invalidKey_ctorFails() {
        assertThatThrownBy(() -> new EncryptionService("not-base64!@#"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Base64");
    }

    @Test
    @DisplayName("Yanlış uzunlukta key (128-bit) — reddedilir, AES-256 zorunlu")
    void shortKey_rejected() {
        String key128 = Base64.getEncoder().encodeToString(new byte[16]);
        assertThatThrownBy(() -> new EncryptionService(key128))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("256-bit");
    }

    @Test
    @DisplayName("Tahrif edilmiş ciphertext (GCM tag fail) — IllegalStateException")
    void tamperDetected() {
        var svc = new EncryptionService(KEY);
        String enc = svc.encrypt("önemli veri");
        // Son karakteri değiştir → tag invalid olur
        String tampered = enc.substring(0, enc.length() - 2) + "XX";
        assertThatThrownBy(() -> svc.decrypt(tampered))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("decrypt");
    }

    @Test
    @DisplayName("null in/out aynen")
    void nullSafe() {
        var svc = new EncryptionService(KEY);
        assertThat(svc.encrypt(null)).isNull();
        assertThat(svc.decrypt(null)).isNull();
    }
}
