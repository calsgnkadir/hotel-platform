package com.hotelapp.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * IP başına rate limiting — Bucket4j token bucket algoritması.
 *
 * F0.3 (FAZ 0) — Güvenlik & memory düzeltmeleri:
 *   1) X-Forwarded-For trusted proxy listesi
 *      ESKİ: saldırgan rastgele 'X-Forwarded-For: 8.8.8.8' yollasa kendini farklı
 *            IP gösterir → rate limit bypass.
 *      YENİ: Sadece TRUSTED_PROXIES listesinden gelen X-Forwarded-For kabul edilir.
 *            (Lokal: localhost; Prod: Railway gibi PaaS — env var TRUSTED_PROXIES ile ayar)
 *
 *   2) Bucket eviction (memory leak fix)
 *      ESKİ: ConcurrentHashMap hiç temizlenmiyordu → uzun çalışan instance şişerdi.
 *            Saldırgan rastgele IP spoof'la map'i şişirebilirdi.
 *      YENİ: Her bucket "last access" timestamp tutar. ScheduledExecutor 5 dk'da bir
 *            10 dk'dan eski bucket'ları siler. Saldırgan 100k spoof'la bile
 *            memory bloat etmez.
 *
 * Kurallar (FAZ D.1 3 tier + FAZ 11.W4.4 public-read tier = 4 tier):
 *  - Auth (/api/auth/**)          : 10 / dakika   (brute-force koruması)
 *  - Sensitive write POST'lar     : 10 / dakika   (spam: mesaj, şikayet, başvuru, ilan)
 *  - Public read GET'ler          : 180 / dakika  (H.5 fix — landing/feed 1 req/s'e takılıyordu)
 *  - Diğer endpointler            : 60 / dakika
 *
 * Sensitive write tier — IP başına ayrı bucket. Authenticated user spam'ini
 * önler ama farklı IP'lerden farklı user'lar etkilenmez. (User-id bazlı bucket
 * ileride filter'da SecurityContext'e erişim refactor'u ile eklenebilir.)
 */
@Component
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    // Bucket + son erişim zamanı — eviction için
    private static class TimedBucket {
        final Bucket bucket;
        volatile long lastAccessNanos;
        TimedBucket(Bucket b) { this.bucket = b; this.lastAccessNanos = System.nanoTime(); }
    }

    private final Map<String, TimedBucket> authBuckets       = new ConcurrentHashMap<>();
    private final Map<String, TimedBucket> sensitiveBuckets  = new ConcurrentHashMap<>();
    private final Map<String, TimedBucket> publicReadBuckets = new ConcurrentHashMap<>();  // FAZ 11.W4.4
    private final Map<String, TimedBucket> generalBuckets    = new ConcurrentHashMap<>();

    /**
     * FAZ D.1 + F.1 — Sensitive write POST endpoint'leri (spam/burst koruması).
     *
     * F.1 fix: exact-match Set yerine prefix/path kontrolu. Mesaj endpoint'i
     * gercekte /api/messages/conversations[/{id}/messages] altinda — exact-match
     * Set ile bu path'lar yakalanmiyor, mesaj spam korumasi olu kaliyor.
     *
     * Sensitive (10/dk):
     *  - POST /api/candidate/applications       (basvuru olustur)
     *  - POST /api/messages/**                  (yeni conversation + mesaj gonder)
     *  - POST /api/reports                      (sikayet)
     *  - POST /api/listings                     (ilan olustur)
     */
    private static boolean isSensitiveWrite(HttpServletRequest req) {
        if (!"POST".equalsIgnoreCase(req.getMethod())) return false;
        String p = req.getRequestURI();
        return "/api/candidate/applications".equals(p)
                || p.startsWith("/api/messages/")
                || "/api/messages".equals(p)
                || "/api/reports".equals(p)
                || "/api/listings".equals(p);
    }

    /**
     * FAZ 11.W4.4 — Public read tier (H.5 finding fix).
     *
     * Landing + ilan feed'i anonim kullanicida sayfa basina 3-5 GET atar
     * (listings + businesses + pulse + facets). Genel 60/dk (~1 req/s)
     * SPA gezinmesinde takiliyordu. Salt-okunur public GET'lere genis
     * kota — mutasyon iceremedigi icin abuse yuzeyi dusuk.
     */
    private static boolean isPublicRead(HttpServletRequest req) {
        if (!"GET".equalsIgnoreCase(req.getMethod())) return false;
        String p = req.getRequestURI();
        return p.startsWith("/api/listings")
                || p.startsWith("/api/businesses")
                || p.startsWith("/api/public/")
                || "/sitemap.xml".equals(p)
                || "/robots.txt".equals(p);
    }

    /**
     * Trusted proxy IP'leri — bunlardan gelen X-Forwarded-For kabul edilir.
     * application.yml: app.security.trusted-proxies=127.0.0.1,::1
     * Prod (Railway): PaaS proxy IP aralığı eklenebilir.
     */
    @Value("${app.security.trusted-proxies:127.0.0.1,::1,0:0:0:0:0:0:0:1}")
    private String trustedProxiesCsv;

    private Set<String> trustedProxies;

    /** Bucket eviction zamanlayıcısı */
    private final ScheduledExecutorService evictor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "rate-limit-evictor");
        t.setDaemon(true);
        return t;
    });
    private static final long IDLE_THRESHOLD_NANOS = TimeUnit.MINUTES.toNanos(10);

    @Override
    protected void initFilterBean() {
        trustedProxies = new HashSet<>(Arrays.asList(trustedProxiesCsv.split("\\s*,\\s*")));
        log.info("RateLimitFilter — trusted proxies: {}", trustedProxies);

        // Her 5 dakikada bir 10 dk'dan eski bucket'ları sil
        evictor.scheduleAtFixedRate(this::evictIdleBuckets, 5, 5, TimeUnit.MINUTES);
    }

    /** FAZ 0/#4 — test'te bypass icin global toggle. */
    @Value("${app.rate-limit.enabled:true}")
    private boolean rateLimitEnabled;

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return !rateLimitEnabled;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String ip = extractIp(request);
        String path = request.getRequestURI();
        boolean isAuth = path.startsWith("/api/auth");
        boolean isSensitiveWrite = !isAuth && isSensitiveWrite(request);
        boolean isPublicRead = !isAuth && !isSensitiveWrite && isPublicRead(request);

        Map<String, TimedBucket> map;
        java.util.function.Supplier<Bucket> bucketBuilder;
        if (isAuth) {
            map = authBuckets;           bucketBuilder = this::buildAuthBucket;
        } else if (isSensitiveWrite) {
            map = sensitiveBuckets;      bucketBuilder = this::buildSensitiveBucket;
        } else if (isPublicRead) {
            map = publicReadBuckets;     bucketBuilder = this::buildPublicReadBucket;  // FAZ 11.W4.4
        } else {
            map = generalBuckets;        bucketBuilder = this::buildGeneralBucket;
        }
        TimedBucket tb = map.computeIfAbsent(ip, k -> new TimedBucket(bucketBuilder.get()));
        tb.lastAccessNanos = System.nanoTime();

        if (tb.bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(
                    "{\"timestamp\":\"" + LocalDateTime.now() + "\"," +
                    "\"status\":429," +
                    "\"error\":\"Too Many Requests\"," +
                    "\"message\":\"Çok fazla istek gönderdiniz. Lütfen bekleyip tekrar deneyin.\"}"
            );
        }
    }

    private Bucket buildAuthBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(10)
                .refillGreedy(10, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    private Bucket buildGeneralBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(60)
                .refillGreedy(60, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    /** FAZ D.1 — Sensitive write POST: dakikada 10. */
    private Bucket buildSensitiveBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(10)
                .refillGreedy(10, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    /** FAZ 11.W4.4 — Public read GET: dakikada 180 (~3 req/s, tunable).
     *  Java default'u da 180: unit testler filter'i `new` ile kurar,
     *  @Value inject olmaz — 0 kalirsa Bucket4j "positive capacity" firlatir. */
    @Value("${app.rate-limit.public-read-per-minute:180}")
    private int publicReadPerMinute = 180;

    private Bucket buildPublicReadBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(publicReadPerMinute)
                .refillGreedy(publicReadPerMinute, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    /**
     * Gerçek client IP'sini çöz.
     *
     * F0.3 fix: Sadece TRUSTED proxy'den gelen X-Forwarded-For'a güven.
     *           Aksi takdirde saldırgan kolayca limit bypass eder.
     */
    private String extractIp(HttpServletRequest request) {
        String remote = request.getRemoteAddr();

        // Eğer istek trusted proxy'den geliyorsa X-Forwarded-For'un en sol değerini al
        if (remote != null && trustedProxies.contains(remote)) {
            String fwd = request.getHeader("X-Forwarded-For");
            if (fwd != null && !fwd.isBlank()) {
                // En sol IP gerçek client. (X-Forwarded-For: client, proxy1, proxy2)
                String candidate = fwd.split(",")[0].trim();
                if (isValidIp(candidate)) return candidate;
            }
        }
        return remote != null ? remote : "unknown";
    }

    private boolean isValidIp(String s) {
        try {
            InetAddress.getByName(s);
            return true;
        } catch (UnknownHostException e) {
            return false;
        }
    }

    /** 10 dk'dan eski bucket'ları sil (memory leak prevention) */
    private void evictIdleBuckets() {
        try {
            long now = System.nanoTime();
            int authRemoved = evict(authBuckets, now);
            int sensitiveRemoved = evict(sensitiveBuckets, now);
            int publicReadRemoved = evict(publicReadBuckets, now);  // FAZ 11.W4.4
            int generalRemoved = evict(generalBuckets, now);
            if (authRemoved + sensitiveRemoved + publicReadRemoved + generalRemoved > 0) {
                log.debug("RateLimit eviction — auth: {}, sensitive: {}, publicRead: {}, general: {} (kalan: {} + {} + {} + {})",
                        authRemoved, sensitiveRemoved, publicReadRemoved, generalRemoved,
                        authBuckets.size(), sensitiveBuckets.size(), publicReadBuckets.size(), generalBuckets.size());
            }
        } catch (Exception ex) {
            log.error("Bucket eviction hatası", ex);
        }
    }

    private int evict(Map<String, TimedBucket> map, long now) {
        List<String> toRemove = map.entrySet().stream()
                .filter(e -> (now - e.getValue().lastAccessNanos) > IDLE_THRESHOLD_NANOS)
                .map(Map.Entry::getKey)
                .toList();
        toRemove.forEach(map::remove);
        return toRemove.size();
    }
}
