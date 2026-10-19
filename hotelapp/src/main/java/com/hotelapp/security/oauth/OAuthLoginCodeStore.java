package com.hotelapp.security.oauth;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Google girişinden sonra tarayıcıya verilen kısa ömürlü, TEK KULLANIMLIK giriş kodu.
 *
 * <p>Eskiden JWT doğrudan yönlendirme adresinin sorgu parametresindeydi
 * ({@code /oauth-success?token=...}): tarayıcı geçmişine, proxy/sunucu loglarına ve
 * Referer'a sızabiliyordu. Şimdi adreste yalnız bu kod taşınır (URL fragment'ında —
 * sunucuya/Referer'a hiç gitmez); frontend kodu {@code POST /api/auth/oauth/exchange}
 * ile erişim token'ı + httpOnly refresh çerezine çevirir.
 *
 * <p>Kod: 256 bit rastgele, {@value #TTL_SECONDS} sn geçerli, ilk kullanımda silinir
 * (atomik {@code remove}). Bellekte yalnız SHA-256 özeti tutulur.
 *
 * <p>Sınır: bellek içi — tek örnek (instance) için. Birden fazla backend örneğinde
 * OAuth dönüşü ile exchange farklı örneğe düşebilir; o durumda paylaşılan depo
 * (DB tablosu/Redis) gerekir.
 */
@Component
public class OAuthLoginCodeStore {

    static final long TTL_SECONDS = 60;
    private static final int MAX_ENTRIES = 10_000;

    private record Entry(Long userId, Instant expiresAt) {}

    private final Map<String, Entry> codes = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final Clock clock;

    public OAuthLoginCodeStore() {
        this(Clock.systemUTC());
    }

    OAuthLoginCodeStore(Clock clock) {
        this.clock = clock;
    }

    /** Kullanıcı için yeni kod üretir (ham kod yalnız dönüş değerinde bulunur). */
    public String issue(Long userId) {
        Instant now = clock.instant();
        if (codes.size() >= MAX_ENTRIES) {
            codes.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(now));
        }
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        codes.put(hash(code), new Entry(userId, now.plus(Duration.ofSeconds(TTL_SECONDS))));
        return code;
    }

    /**
     * Kodu TÜKETMEDEN okur (KVKK onayı eksikse kullanıcı aynı kodla tekrar dener).
     * Geçerliyse kullanıcı id'si; yoksa/süresi dolmuşsa boş. Oturum yalnız
     * {@link #consume} başarılıysa açılır.
     */
    public Optional<Long> peek(String code) {
        if (code == null || code.isBlank() || code.length() > 128) return Optional.empty();
        Entry e = codes.get(hash(code));
        if (e == null || !clock.instant().isBefore(e.expiresAt())) return Optional.empty();
        return Optional.of(e.userId());
    }

    /** Kodu tüketir: geçerliyse kullanıcı id'si; yoksa/süresi dolmuşsa/kullanılmışsa boş. */
    public Optional<Long> consume(String code) {
        if (code == null || code.isBlank() || code.length() > 128) return Optional.empty();
        Entry e = codes.remove(hash(code));
        if (e == null || !clock.instant().isBefore(e.expiresAt())) return Optional.empty();
        return Optional.of(e.userId());
    }

    private static String hash(String code) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(code.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(d);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
