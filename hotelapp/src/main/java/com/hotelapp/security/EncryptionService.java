package com.hotelapp.security;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * FAZ H.4 — Field-level AES-GCM encryption (KVKK m.12).
 *
 * Tehdit modeli:
 *  - DB snapshot çalınırsa: hassas belge yolları (Cloudinary public_id) +
 *    orijinal dosya adları PLAIN-TEXT okunmasın.
 *  - Cloudinary tarafı zaten signed URL ile koruma sağlıyor; bu katman
 *    "asla DB tek başına yeterli olmasın" anlamında defense-in-depth.
 *
 * Format: "enc1:" + base64(IV(12) || ciphertext+tag)
 *  - Prefix sayesinde legacy (şifresiz) verilerle birlikte yaşar
 *  - Migration zorunlu değil — sonraki yazımlar şifreli, eskiler kalır
 *
 * Key: APP_ENCRYPTION_KEY env var, base64-encoded 256-bit (32 byte).
 *  - Boş bırakılırsa SERVICE no-op (dev/test, encrypt çağrısı plain döner)
 *  - Prod'da set edilmesi zorunlu — log uyarısı boot'ta düşer
 */
@Service
@Slf4j
public class EncryptionService {

    public static final String PREFIX = "enc1:";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final int IV_LEN = 12;     // GCM standart
    private static final int TAG_BITS = 128;  // GCM auth tag

    private final byte[] keyBytes;
    private final boolean enabled;
    private final SecureRandom rng = new SecureRandom();

    public EncryptionService(@Value("${app.encryption.key:}") String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            this.keyBytes = null;
            this.enabled = false;
        } else {
            byte[] decoded;
            try {
                decoded = Base64.getDecoder().decode(base64Key);
            } catch (IllegalArgumentException e) {
                throw new IllegalStateException(
                        "app.encryption.key Base64 decode hatasi — env var dogru mu?", e);
            }
            if (decoded.length != 32) {
                throw new IllegalStateException(
                        "app.encryption.key 256-bit (32 byte) olmali, " + decoded.length + " geldi");
            }
            this.keyBytes = decoded;
            this.enabled = true;
        }
    }

    @PostConstruct
    void warnIfDisabled() {
        if (!enabled) {
            log.warn("[ENCRYPTION] APP_ENCRYPTION_KEY set degil — field encryption DEVRE DISI " +
                     "(dev/test'te ok, prod'da KVKK risk).");
        } else {
            log.info("[ENCRYPTION] Field encryption aktif (AES-GCM 256-bit)");
        }
    }

    /** Encrypt. Disabled ise plain döner. Zaten enc1: prefixli ise olduğu gibi (re-encrypt yok). */
    public String encrypt(String plain) {
        if (plain == null) return null;
        if (!enabled) return plain;
        if (plain.startsWith(PREFIX)) return plain;
        try {
            byte[] iv = new byte[IV_LEN];
            rng.nextBytes(iv);
            Cipher c = Cipher.getInstance(CIPHER);
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(keyBytes, "AES"),
                    new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ct, 0, combined, iv.length, ct.length);
            return PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("AES-GCM encrypt hatasi", e);
        }
    }

    /** Decrypt. Prefix yoksa legacy plain → olduğu gibi döner. */
    public String decrypt(String stored) {
        if (stored == null) return null;
        if (!stored.startsWith(PREFIX)) return stored;
        if (!enabled) {
            // Şifreli okunduğunda key yoksa, bu prod->dev geçişi olabilir; aç
            throw new IllegalStateException(
                    "Sifreli veri okundu fakat APP_ENCRYPTION_KEY set degil");
        }
        try {
            byte[] combined = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            if (combined.length < IV_LEN + 16) {
                throw new IllegalStateException("Cok kisa sifreli veri");
            }
            byte[] iv = new byte[IV_LEN];
            byte[] ct = new byte[combined.length - IV_LEN];
            System.arraycopy(combined, 0, iv, 0, IV_LEN);
            System.arraycopy(combined, IV_LEN, ct, 0, ct.length);
            Cipher c = Cipher.getInstance(CIPHER);
            c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(keyBytes, "AES"),
                    new GCMParameterSpec(TAG_BITS, iv));
            return new String(c.doFinal(ct), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("AES-GCM decrypt hatasi", e);
        }
    }

    /** Test / DI dışı kullanım için: holder set'e izin verir. */
    @PostConstruct
    void registerStatic() {
        EncryptionHolder.set(this);
    }
}
