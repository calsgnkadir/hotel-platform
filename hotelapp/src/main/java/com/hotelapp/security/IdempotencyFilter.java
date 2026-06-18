package com.hotelapp.security;

import com.hotelapp.metrics.AppMetrics;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * FAZ D.2 — Idempotency-Key support.
 *
 * Client retry'larini onler. Sadece:
 *   - POST istekleri
 *   - "Idempotency-Key" header'i olanlar
 *   - Authenticated istekler (anonymous icin gereksiz — JWT yoksa auth zaten basarisiz)
 *
 * Akis:
 *   1. preFilter: cache'te key+user var mi? Varsa cached response donulur.
 *   2. Yoksa controller calistirilir, response capture edilir.
 *   3. Status 2xx ise cache'e yazilir (4xx/5xx cache'lenmez — client'in yeniden
 *      denemesi gerekebilir).
 *
 * Filter sirasi (SecurityConfig): RateLimit -> JwtAuth -> Idempotency -> controller.
 * Boylece SecurityContext set edilmis olur ve userId'ye erisilir.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IdempotencyFilter extends OncePerRequestFilter {

    public static final String HEADER = "Idempotency-Key";
    private static final int MAX_KEY_LENGTH = 128;

    private final IdempotencyService service;
    private final org.springframework.beans.factory.ObjectProvider<AppMetrics> metrics; // optional

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {

        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        String idemKey = request.getHeader(HEADER);
        if (idemKey == null || idemKey.isBlank()) {
            chain.doFilter(request, response);
            return;
        }
        if (idemKey.length() > MAX_KEY_LENGTH) {
            response.sendError(HttpServletResponse.SC_BAD_REQUEST,
                    "Idempotency-Key cok uzun (max " + MAX_KEY_LENGTH + ")");
            return;
        }

        Long userId = currentUserId();
        if (userId == null) {
            // Anonymous + idempotency-key — sessizce gec, auth zaten reject edecek
            chain.doFilter(request, response);
            return;
        }

        String cacheKey = userId + ":" + idemKey;
        AppMetrics m = metrics.getIfAvailable();
        IdempotencyService.CachedResponse cached = service.find(cacheKey);
        if (cached != null) {
            log.debug("[IDEMPOTENCY] cache hit user={} key={} status={}",
                    userId, idemKey, cached.status());
            if (m != null) m.idempotencyHit.increment();
            response.setStatus(cached.status());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            response.setHeader("X-Idempotent-Replay", "true");
            response.getWriter().write(cached.body());
            return;
        }
        if (m != null) m.idempotencyMiss.increment();

        ContentCachingResponseWrapper wrapper = new ContentCachingResponseWrapper(response);
        chain.doFilter(request, wrapper);

        int status = wrapper.getStatus();
        if (status >= 200 && status < 300) {
            byte[] body = wrapper.getContentAsByteArray();
            String bodyStr = new String(body, StandardCharsets.UTF_8);
            service.store(cacheKey, status, bodyStr);
        }
        wrapper.copyBodyToResponse();
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal up) return up.getId();
        return null;
    }
}
