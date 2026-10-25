package com.hotelapp.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giris denemesi siniri: (e-posta + istemci IP) basina 15 dakikada 10 basarisiz deneme.
 *
 * Anahtar yalniz e-posta olsaydi saldirgan hedef e-postaya 10 yanlis parola gondererek
 * gercek kullaniciyi dogru parolayla bile surekli kilitli tutabilirdi (hesap kilitleme
 * DoS). IP de anahtarda oldugundan kilit yalniz deneme yapan IP'yi etkiler; baska
 * IP'deki gercek kullanici girebilir. Hesap var/yok fark etmez (anahtar girilen
 * e-posta) — hesap varligi ifsa edilmez.
 *
 * Deneme basta tuketilir (paralel denemeler de sayilir); basarili giriste kova
 * sifirlanir. Net etki: yalniz basarisiz denemeler sayilir, dogru parolali girisler
 * kovayi tuketmez.
 *
 * Dagitik deneme (ayni e-postaya cok IP'den): e-posta basina ayri bir basarisizlik
 * sayaci tutulur (15 dk'da {@link #GLOBAL_ALERT_THRESHOLD}). Esik asilirsa yalniz
 * uyari loglanir, KILITLEMEZ — kilitleme gercek kullaniciyi yeniden DoS'a acardi.
 * Dagitik denemenin hizini IP basina auth kovasi (RateLimitFilter) ve BCrypt maliyeti
 * sinirlar.
 *
 * Bellek: 15 dk'dan uzun bosta kalan kovalar periyodik silinir.
 */
@Component
@Slf4j
public class LoginAttemptLimiter {

    static final int MAX_ATTEMPTS = 10;
    static final int GLOBAL_ALERT_THRESHOLD = 50;
    static final Duration WINDOW = Duration.ofMinutes(15);
    private static final long IDLE_NANOS = WINDOW.toNanos();

    private static final class TimedBucket {
        final Bucket bucket;
        volatile long lastAccessNanos = System.nanoTime();
        volatile boolean alerted;
        TimedBucket(Bucket bucket) { this.bucket = bucket; }
    }

    /** Anahtar: e-posta|ip — kilit kovasi. */
    private final Map<String, TimedBucket> buckets = new ConcurrentHashMap<>();
    /** Anahtar: e-posta — yalniz izleme (kilitlemez). */
    private final Map<String, TimedBucket> emailFailures = new ConcurrentHashMap<>();

    /** Bir deneme hakki tuketir; bu e-posta+IP icin hak kalmadiysa false. */
    public boolean tryAcquire(String email, String ip) {
        String key = key(email, ip);
        if (key == null) return true;   // bos e-posta: Bean Validation zaten reddeder
        TimedBucket tb = buckets.computeIfAbsent(key, k -> new TimedBucket(newBucket(MAX_ATTEMPTS)));
        tb.lastAccessNanos = System.nanoTime();
        return tb.bucket.tryConsume(1);
    }

    /** Basarili giris: bu e-posta+IP sayaci sifirlanir (deneme hakki iade). */
    public void reset(String email, String ip) {
        String key = key(email, ip);
        if (key != null) buckets.remove(key);
    }

    /**
     * Basarisiz giris: e-posta basina dagitik deneme sayaci. Esik asilinca pencere
     * basina bir kez uyari loglanir; giris engellenmez.
     *
     * @return esik bu cagrida asildiysa true (test/izleme icin)
     */
    public boolean recordFailure(String email) {
        String key = normalizeEmail(email);
        if (key == null) return false;
        TimedBucket tb = emailFailures.computeIfAbsent(key,
                k -> new TimedBucket(newBucket(GLOBAL_ALERT_THRESHOLD)));
        tb.lastAccessNanos = System.nanoTime();
        if (tb.bucket.tryConsume(1)) {
            tb.alerted = false;   // pencere yenilendi: bir sonraki asimda yeniden uyar
            return false;
        }
        if (tb.alerted) return false;
        tb.alerted = true;
        log.warn("[LOGIN-LIMIT] Ayni hesaba dagitik giris denemesi: email={} {} dk icinde {}+ basarisiz deneme (kilitlenmedi)",
                mask(key), WINDOW.toMinutes(), GLOBAL_ALERT_THRESHOLD);
        return true;
    }

    /** Bellek temizligi; test profilinde ilk calisma ~1 yil ertelenir (application-test.yml). */
    @Scheduled(fixedDelayString = "${app.scheduling.login-attempt-evict-delay-ms:300000}",
               initialDelayString = "${app.scheduling.login-attempt-evict-initial-delay-ms:300000}")
    void evictIdle() {
        long now = System.nanoTime();
        buckets.entrySet().removeIf(e -> now - e.getValue().lastAccessNanos > IDLE_NANOS);
        emailFailures.entrySet().removeIf(e -> now - e.getValue().lastAccessNanos > IDLE_NANOS);
    }

    int size() { return buckets.size(); }

    private static String key(String email, String ip) {
        String e = normalizeEmail(email);
        if (e == null) return null;
        String i = (ip == null || ip.isBlank()) ? "unknown" : ip.trim();
        return e + "|" + i;
    }

    private static String normalizeEmail(String email) {
        if (email == null) return null;
        String k = email.trim().toLowerCase(Locale.ROOT);
        return k.isEmpty() ? null : k;
    }

    /** Log icin e-posta maskeleme (KVKK) — ortak yardimci {@link PiiMasking#email}. */
    static String mask(String email) {
        return PiiMasking.email(email);
    }

    private static Bucket newBucket(int capacity) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(capacity)
                        .refillIntervally(capacity, WINDOW)
                        .build())
                .build();
    }
}
