package com.hotelapp.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * FAZ H.3 — Correlation ID filter.
 *
 * Her HTTP request başında:
 *  - X-Correlation-Id header'ı varsa onu kullan (upstream gateway/proxy zinciri)
 *  - Yoksa yeni UUID üret
 * MDC'ye 'cid' anahtarı ile koy → logback PatternLayout %X{cid} ile her
 * log satırına basar. Response'a da X-Correlation-Id header eklenir
 * (frontend / log korelasyonu).
 *
 * Filter chain'de EN ÖNDE: rate limit ve JWT öncesi MDC dolu olsun ki
 * her log line'da cid görünsün.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    public static final String MDC_KEY = "cid";
    public static final String HEADER  = "X-Correlation-Id";

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {

        String inbound = request.getHeader(HEADER);
        String cid = (inbound != null && !inbound.isBlank() && inbound.length() <= 64)
                ? sanitize(inbound)
                : shortUuid();

        try {
            MDC.put(MDC_KEY, cid);
            response.setHeader(HEADER, cid);
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }

    private static String shortUuid() {
        // 32-char UUID hex, 12 char yeterli — log spam'ini azaltır
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    /** Sadece alphanumeric + - _; injection güvenliği. */
    private static String sanitize(String in) {
        StringBuilder out = new StringBuilder(in.length());
        for (int i = 0; i < in.length(); i++) {
            char c = in.charAt(i);
            if (Character.isLetterOrDigit(c) || c == '-' || c == '_') out.append(c);
        }
        return out.length() == 0 ? shortUuid() : out.toString();
    }
}
