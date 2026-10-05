package com.hotelapp.service;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * Web Push mesaj şifrelemesi — RFC 8291 (aes128gcm içerik kodlaması, RFC 8188).
 *
 * Tarayıcılar push içeriğini yalnızca şifreli kabul eder; push sunucusu (FCM,
 * Mozilla...) içeriği okuyamaz. VapidService gibi sadece Java 17 JCE kullanır,
 * dış kütüphane yok. Doğruluk: RFC 8291 Ek A test vektörüyle birebir (testte).
 *
 * Çıktı gövdesi: salt(16) | rs(4, BE) | idlen(1)=65 | as_public(65) | AES-GCM şifreli metin.
 */
public final class WebPushEncryption {

    /** Kayıt boyutu; tek kayıt yeter (push içerikleri en fazla ~4 KB). */
    private static final int RECORD_SIZE = 4096;
    /**
     * Push servisleri gövdeyi 4096 baytla sınırlar:
     * başlık (86) + GCM etiketi (16) + ayraç (1) düşülünce kalan düz metin.
     */
    public static final int MAX_PLAINTEXT = 4096 - 86 - 16 - 1;

    private static final ECParameterSpec P256 = p256();
    private static final SecureRandom RANDOM = new SecureRandom();

    private WebPushEncryption() {}

    /**
     * Tarayıcının aboneliğindeki anahtarlarla şifreler.
     * @param uaPublicB64  abonelik keys.p256dh (Base64URL, 65 bayt sıkıştırılmamış nokta)
     * @param authSecretB64 abonelik keys.auth (Base64URL, 16 bayt)
     */
    public static byte[] encrypt(byte[] plaintext, String uaPublicB64, String authSecretB64) throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
        byte[] salt = new byte[16];
        RANDOM.nextBytes(salt);
        return encrypt(plaintext, b64(uaPublicB64), b64(authSecretB64), gen.generateKeyPair(), salt);
    }

    /** Deterministik çekirdek — test vektörü için anahtar çifti ve salt dışarıdan verilir. */
    static byte[] encrypt(byte[] plaintext, byte[] uaPublic, byte[] authSecret,
                          KeyPair asKeys, byte[] salt) throws Exception {
        if (plaintext.length > MAX_PLAINTEXT) {
            throw new IllegalArgumentException("Push içeriği çok büyük: " + plaintext.length + " bayt");
        }
        if (authSecret.length != 16) throw new IllegalArgumentException("auth secret 16 bayt olmalı");
        if (salt.length != 16) throw new IllegalArgumentException("salt 16 bayt olmalı");

        ECPublicKey uaKey = publicKeyFromRaw(uaPublic);
        byte[] asPublic = rawPublic((ECPublicKey) asKeys.getPublic());

        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(asKeys.getPrivate());
        ka.doPhase(uaKey, true);
        byte[] ecdhSecret = leftPad32(ka.generateSecret());

        // RFC 8291 §3.4: auth secret ile IKM türet
        byte[] prkKey = hmac(authSecret, ecdhSecret);
        byte[] keyInfo = concat(ascii("WebPush: info\0"), uaPublic, asPublic);
        byte[] ikm = hmac(prkKey, keyInfo, new byte[]{1});

        // RFC 8188 §2.2-2.3: salt ile içerik anahtarı ve nonce
        byte[] prk = hmac(salt, ikm);
        byte[] cek = Arrays.copyOf(hmac(prk, ascii("Content-Encoding: aes128gcm\0"), new byte[]{1}), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, ascii("Content-Encoding: nonce\0"), new byte[]{1}), 12);

        // Tek (son) kayıt: düz metin + 0x02 ayracı, ek dolgu yok
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] ciphertext = cipher.doFinal(concat(plaintext, new byte[]{2}));

        byte[] header = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length)
                .put(salt).putInt(RECORD_SIZE).put((byte) asPublic.length).put(asPublic)
                .array();
        return concat(header, ciphertext);
    }

    // ─── anahtar dönüşümleri ─────────────────────────────────────────────

    static ECPublicKey publicKeyFromRaw(byte[] raw) throws Exception {
        if (raw.length != 65 || raw[0] != 0x04) {
            throw new IllegalArgumentException("p256dh 65 baytlık sıkıştırılmamış P-256 noktası olmalı");
        }
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(raw, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(raw, 33, 65));
        return (ECPublicKey) KeyFactory.getInstance("EC")
                .generatePublic(new ECPublicKeySpec(new ECPoint(x, y), P256));
    }

    static ECPrivateKey privateKeyFromRaw(byte[] raw) throws Exception {
        return (ECPrivateKey) KeyFactory.getInstance("EC")
                .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, raw), P256));
    }

    static byte[] rawPublic(ECPublicKey key) {
        byte[] out = new byte[65];
        out[0] = 0x04;
        fixed32(key.getW().getAffineX(), out, 1);
        fixed32(key.getW().getAffineY(), out, 33);
        return out;
    }

    private static void fixed32(BigInteger v, byte[] dst, int offset) {
        byte[] b = v.toByteArray();
        int len = Math.min(b.length, 32);
        System.arraycopy(b, b.length - len, dst, offset + 32 - len, len);
    }

    // ─── yardımcılar ─────────────────────────────────────────────────────

    /** ECDH sırrı 32 bayt olmalı; sağlayıcı baştaki sıfırı atarsa geri ekle. */
    private static byte[] leftPad32(byte[] b) {
        if (b.length >= 32) return b;
        byte[] out = new byte[32];
        System.arraycopy(b, 0, out, 32 - b.length, b.length);
        return out;
    }

    private static byte[] hmac(byte[] key, byte[]... parts) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        for (byte[] p : parts) mac.update(p);
        return mac.doFinal();
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] p : parts) out.writeBytes(p);
        return out.toByteArray();
    }

    private static byte[] ascii(String s) {
        return s.getBytes(StandardCharsets.US_ASCII);
    }

    static byte[] b64(String s) {
        return Base64.getUrlDecoder().decode(s.replace('+', '-').replace('/', '_').replace("=", ""));
    }

    private static ECParameterSpec p256() {
        try {
            AlgorithmParameters ap = AlgorithmParameters.getInstance("EC");
            ap.init(new ECGenParameterSpec("secp256r1"));
            return ap.getParameterSpec(ECParameterSpec.class);
        } catch (Exception e) {
            throw new ExceptionInInitializerError(e);
        }
    }
}
