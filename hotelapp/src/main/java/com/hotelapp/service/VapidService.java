package com.hotelapp.service;

import io.jsonwebtoken.Jwts;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigInteger;
import java.net.URI;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Date;

/**
 * FAZ 1/#23 — VAPID (RFC 8292) — Pure Java.
 *
 * Web Push'a authentication: ECDSA P-256 imzali JWT (ES256).
 * Bouncycastle vs nl.martijndwars:web-push DEP'I YOK — Java 17 JCE built-in.
 *
 * Anahtarlar:
 *  - public-key: 65-byte uncompressed (0x04 || X(32) || Y(32)), Base64URL-no-padding
 *  - private-key: 32-byte raw, Base64URL-no-padding
 *
 * Eger config'te bos ise startup'ta auto-generate + log basar (dev kullanim icin).
 */
@Service
@Slf4j
public class VapidService {

    @Value("${app.push.vapid.public-key:}")  private String publicKeyB64;
    @Value("${app.push.vapid.private-key:}") private String privateKeyB64;
    @Value("${app.push.vapid.subject:mailto:noreply@ajanshotel.local}")
    private String subject;

    private ECPrivateKey privateKey;
    private String publicKeyForHeader;  // Base64URL no-padding
    private ECParameterSpec params;

    @PostConstruct
    void init() throws Exception {
        // P-256 (secp256r1 / prime256v1) param spec'i bir kez al
        AlgorithmParameters ap = AlgorithmParameters.getInstance("EC");
        ap.init(new ECGenParameterSpec("secp256r1"));
        this.params = ap.getParameterSpec(ECParameterSpec.class);

        if (publicKeyB64 == null || publicKeyB64.isBlank() ||
                privateKeyB64 == null || privateKeyB64.isBlank()) {
            // Auto-generate (dev kolaylik)
            KeyPair kp = generateKeyPair();
            byte[] privBytes = privateBytes((ECPrivateKey) kp.getPrivate());
            byte[] pubBytes  = publicBytes((ECPublicKey) kp.getPublic());
            this.publicKeyB64  = b64url(pubBytes);
            this.privateKeyB64 = b64url(privBytes);
            log.warn("=================================================================");
            log.warn("FAZ 1/#23 — VAPID anahtarlari yok, AUTO-GENERATE edildi.");
            log.warn("Prod icin env'e ekle (yoksa restart'ta abone uyumsuz olur):");
            log.warn("  VAPID_PUBLIC_KEY={}",  this.publicKeyB64);
            log.warn("  VAPID_PRIVATE_KEY={}", this.privateKeyB64);
            log.warn("=================================================================");
        }

        // Load private key (BigInteger -> ECPrivateKeySpec)
        byte[] privRaw = b64urlDecode(privateKeyB64);
        BigInteger s = new BigInteger(1, privRaw);
        KeyFactory kf = KeyFactory.getInstance("EC");
        this.privateKey = (ECPrivateKey) kf.generatePrivate(new ECPrivateKeySpec(s, params));

        this.publicKeyForHeader = publicKeyB64;
        log.info("FAZ 1/#23 — VAPID hazir. PublicKey (kisa): {}...",
                publicKeyB64.substring(0, Math.min(20, publicKeyB64.length())));
    }

    /** Frontend'e verilecek public key — Base64URL no-padding (65 byte uncompressed). */
    public String getPublicKey() {
        return publicKeyForHeader;
    }

    /**
     * Push endpoint'e gonderilecek Authorization header degeri:
     *   "vapid t=<JWT>, k=<pub-key-b64url>"
     * @param endpoint push server URL (https://fcm.googleapis.com/...)
     */
    public String buildAuthHeader(String endpoint) {
        try {
            URI uri = URI.create(endpoint);
            String aud = uri.getScheme() + "://" + uri.getHost();
            String jwt = Jwts.builder()
                    .header().add("typ", "JWT").and()
                    .audience().add(aud).and()
                    .expiration(Date.from(Instant.now().plusSeconds(12 * 3600))) // 12h
                    .subject(subject)
                    .signWith(privateKey, Jwts.SIG.ES256)
                    .compact();
            return "vapid t=" + jwt + ", k=" + publicKeyForHeader;
        } catch (Exception e) {
            throw new RuntimeException("VAPID JWT olusturulamadi: " + e.getMessage(), e);
        }
    }

    // ─── helpers ─────────────────────────────────────────────────────────

    private KeyPair generateKeyPair() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"), new SecureRandom());
        return gen.generateKeyPair();
    }

    private byte[] privateBytes(ECPrivateKey priv) {
        return toFixedLength(priv.getS().toByteArray(), 32);
    }

    private byte[] publicBytes(ECPublicKey pub) {
        ECPoint w = pub.getW();
        byte[] x = toFixedLength(w.getAffineX().toByteArray(), 32);
        byte[] y = toFixedLength(w.getAffineY().toByteArray(), 32);
        byte[] out = new byte[65];
        out[0] = 0x04;
        System.arraycopy(x, 0, out, 1, 32);
        System.arraycopy(y, 0, out, 33, 32);
        return out;
    }

    /** BigInteger.toByteArray() leading-zero veya sign-byte ekleyebilir; sabit uzunluga normalize et. */
    private byte[] toFixedLength(byte[] src, int len) {
        if (src.length == len) return src;
        if (src.length == len + 1 && src[0] == 0) return Arrays.copyOfRange(src, 1, src.length);
        if (src.length < len) {
            byte[] out = new byte[len];
            System.arraycopy(src, 0, out, len - src.length, src.length);
            return out;
        }
        throw new IllegalArgumentException("Beklenmedik byte uzunlugu: " + src.length);
    }

    private static String b64url(byte[] data) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }

    private static byte[] b64urlDecode(String s) {
        return Base64.getUrlDecoder().decode(s);
    }
}
