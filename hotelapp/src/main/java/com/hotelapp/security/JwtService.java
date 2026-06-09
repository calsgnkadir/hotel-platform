package com.hotelapp.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * JWT üretimi + doğrulama (F0.1 fix — best practice güvenlik).
 *
 * F0.1 değişikliği:
 *   ESKİ:  secretKey.getBytes(UTF_8) — ASCII string'i HMAC anahtarı sayardı.
 *          → Gerçek random byte değil, entropi düşük, brute force'a daha açık.
 *   YENİ:  Önce **Base64 decode** denenir; başarısızsa UTF-8 fallback.
 *          → Doğru pratik: secret zaten random byte'lerin Base64 encoding'idir.
 *          → İlk başlatmada anahtar uzunluğu (>= 256 bit / 32 byte) kontrol edilir.
 */
@Service
@Slf4j
public class JwtService {

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.expiration}")
    private long expirationMs;

    /**
     * Kendi içinde cache'lenmiş anahtar — her request'te tekrar decode etme.
     * volatile değil çünkü application start'ta @PostConstruct ile dolar, sonra read-only.
     */
    private SecretKey signingKey;

    @PostConstruct
    void initKey() {
        if (secretKey == null || secretKey.isBlank()) {
            throw new IllegalStateException(
                    "jwt.secret tanımlı değil. application.yml veya env var ile ayarlayın.");
        }

        byte[] keyBytes;
        try {
            // Doğru yol: Base64 decode (production'da gerçek random byte'ler için)
            keyBytes = Base64.getDecoder().decode(secretKey);
            log.info("JWT secret Base64'ten decode edildi ({} byte)", keyBytes.length);
        } catch (IllegalArgumentException notBase64) {
            // Backward compat: eski dev/prod secret'ları string olabilir
            keyBytes = secretKey.getBytes(StandardCharsets.UTF_8);
            log.warn("JWT secret Base64 değil — UTF-8 fallback ({} byte). " +
                     "Production için Base64 öneririz: openssl rand -base64 48", keyBytes.length);
        }

        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "JWT secret en az 32 byte olmalı (HMAC-SHA256 256-bit). " +
                    "Şu an: " + keyBytes.length + " byte. " +
                    "Yeni anahtar üret: openssl rand -base64 48");
        }

        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    // Token oluştur
    public String generateToken(UserDetails userDetails) {
        return generateToken(new HashMap<>(), userDetails);
    }

    public String generateToken(Map<String, Object> extraClaims, UserDetails userDetails) {
        return Jwts.builder()
                .claims(extraClaims)
                .subject(userDetails.getUsername())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(signingKey)
                .compact();
    }

    // Token geçerli mi?
    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
