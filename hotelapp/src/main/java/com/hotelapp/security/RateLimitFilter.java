package com.hotelapp.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * IP başına rate limiting — Bucket4j token bucket algoritması.
 *
 * Kurallar:
 *  - Auth endpointleri (/api/auth/**): 10 istek / dakika
 *    → brute-force şifre deneme saldırılarına karşı
 *  - Diğer tüm endpointler: 60 istek / dakika
 *    → genel API kötüye kullanımına karşı
 *
 * Her IP için ayrı bucket tutulur (ConcurrentHashMap).
 * Uygulama restart'ta sıfırlanır — Redis entegrasyonu ileriki adımda.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    // IP → Bucket eşlemesi
    private final Map<String, Bucket> authBuckets    = new ConcurrentHashMap<>();
    private final Map<String, Bucket> generalBuckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {

        String ip = extractIp(request);
        String path = request.getRequestURI();

        Bucket bucket = path.startsWith("/api/auth")
                ? authBuckets.computeIfAbsent(ip, k -> buildAuthBucket())
                : generalBuckets.computeIfAbsent(ip, k -> buildGeneralBucket());

        if (bucket.tryConsume(1)) {
            // Token var, devam et
            filterChain.doFilter(request, response);
        } else {
            // Token bitti → 429 Too Many Requests
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

    // Auth: 10 istek / dakika (brute-force koruması)
    private Bucket buildAuthBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(10)
                .refillGreedy(10, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    // Genel: 60 istek / dakika
    private Bucket buildGeneralBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(60)
                .refillGreedy(60, Duration.ofMinutes(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    // Proxy arkasındaysa gerçek IP'yi al (X-Forwarded-For)
    private String extractIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
