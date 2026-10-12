package com.hotelapp.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * E-posta basina giris denemesi siniri (IP'den bagimsiz): 15 dakikada 10 deneme.
 *
 * IP kovasi (RateLimitFilter) dagitik/botnet denemesini durdurmaz; ayni hesaba
 * farkli IP'lerden parola denemesi bu sinirla yavaslar. Hesap var/yok fark etmez
 * (anahtar girilen e-posta) — hesap varligi ifsa edilmez.
 *
 * Deneme basta tuketilir (paralel denemeler de sayilir); basarili giriste kova
 * sifirlanir, boylece mesru kullanici birkac yanlis denemeden sonra cezali kalmaz.
 * Bellek: 15 dk'dan uzun bosta kalan kovalar periyodik silinir.
 */
@Component
public class LoginAttemptLimiter {

    static final int MAX_ATTEMPTS = 10;
    static final Duration WINDOW = Duration.ofMinutes(15);
    private static final long IDLE_NANOS = WINDOW.toNanos();

    private static final class TimedBucket {
        final Bucket bucket;
        volatile long lastAccessNanos = System.nanoTime();
        TimedBucket(Bucket bucket) { this.bucket = bucket; }
    }

    private final Map<String, TimedBucket> buckets = new ConcurrentHashMap<>();

    /** Bir deneme hakki tuketir; hak kalmadiysa false. */
    public boolean tryAcquire(String email) {
        String key = key(email);
        if (key == null) return true;   // bos e-posta: Bean Validation zaten reddeder
        TimedBucket tb = buckets.computeIfAbsent(key, k -> new TimedBucket(newBucket()));
        tb.lastAccessNanos = System.nanoTime();
        return tb.bucket.tryConsume(1);
    }

    /** Basarili giris: bu e-postanin sayaci sifirlanir. */
    public void reset(String email) {
        String key = key(email);
        if (key != null) buckets.remove(key);
    }

    @Scheduled(fixedDelay = 5, timeUnit = TimeUnit.MINUTES)
    void evictIdle() {
        long now = System.nanoTime();
        buckets.entrySet().removeIf(e -> now - e.getValue().lastAccessNanos > IDLE_NANOS);
    }

    int size() { return buckets.size(); }

    private static String key(String email) {
        if (email == null) return null;
        String k = email.trim().toLowerCase(Locale.ROOT);
        return k.isEmpty() ? null : k;
    }

    private static Bucket newBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(MAX_ATTEMPTS)
                        .refillIntervally(MAX_ATTEMPTS, WINDOW)
                        .build())
                .build();
    }
}
