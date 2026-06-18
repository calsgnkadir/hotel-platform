package com.hotelapp.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * FAZ D.2 — Idempotency-Key cache.
 *
 * Client retry'lari (double-click, network blip) icin POST endpoint'lerinin
 * tekrar tetiklenmesini onler. Filter cached response'u dondurur, ana service
 * cagrilmaz.
 *
 * In-memory (ConcurrentHashMap): single instance icin yeterli. Multi-instance
 * deployment'a gecince Redis-backed implementasyona swap edilebilir
 * (IdempotencyFilter degismez, sadece bu bean replace).
 *
 * TTL: 1 saat (config: app.idempotency.ttl-minutes).
 * Eviction: her 10 dakikada bir.
 */
@Service
@Slf4j
public class IdempotencyService {

    public record CachedResponse(int status, String body) {}

    private record CachedEntry(CachedResponse response, Instant expiresAt) {}

    private final Map<String, CachedEntry> cache = new ConcurrentHashMap<>();

    @Value("${app.idempotency.ttl-minutes:60}")
    private long ttlMinutes;

    /** Key formati: "userId:idempotencyKey". Lookup. */
    public CachedResponse find(String cacheKey) {
        CachedEntry e = cache.get(cacheKey);
        if (e == null) return null;
        if (Instant.now().isAfter(e.expiresAt())) {
            cache.remove(cacheKey);
            return null;
        }
        return e.response();
    }

    public void store(String cacheKey, int status, String body) {
        Instant expires = Instant.now().plus(Duration.ofMinutes(ttlMinutes));
        cache.put(cacheKey, new CachedEntry(new CachedResponse(status, body), expires));
    }

    /** Her 10 dakikada bir expired entry'leri sil. */
    @Scheduled(fixedDelay = 10 * 60 * 1000L)
    public void evictExpired() {
        Instant now = Instant.now();
        int before = cache.size();
        cache.entrySet().removeIf(e -> now.isAfter(e.getValue().expiresAt()));
        int removed = before - cache.size();
        if (removed > 0) {
            log.debug("[IDEMPOTENCY] {} expired entry silindi, kalan: {}", removed, cache.size());
        }
    }

    /** Test için: cache'i temizle. */
    public void clearAll() {
        cache.clear();
    }
}
