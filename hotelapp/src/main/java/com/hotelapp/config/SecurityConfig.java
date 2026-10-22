package com.hotelapp.config;

import com.hotelapp.security.IdempotencyFilter;
import com.hotelapp.security.JwtAuthFilter;
import com.hotelapp.security.RateLimitFilter;
import com.hotelapp.security.oauth.CustomOAuth2UserService;
import com.hotelapp.security.oauth.OAuth2SuccessHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.HeadersConfigurer;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final RateLimitFilter rateLimitFilter;
    private final IdempotencyFilter idempotencyFilter; // FAZ D.2
    private final AuthenticationProvider authenticationProvider;

    /** #92: Google OAuth — opsiyonel (env yoksa null) */
    private final CustomOAuth2UserService oAuth2UserService;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;

    /** 403 gövdesi (Türkçe/İngilizce, Accept-Language) — GlobalExceptionHandler ile aynı biçim. */
    private final Messages messages;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    /**
     * Swagger/OpenAPI yalnız açıkken herkese açık. Prod'da varsayılan kapalı
     * (application-prod.yml: SWAGGER_ENABLED); kapalıyken bu yollar izinli listeden
     * çıkar → girişsiz 401, girişli 404.
     */
    @Value("${springdoc.api-docs.enabled:true}")
    private boolean apiDocsEnabled;
    @Value("${springdoc.swagger-ui.enabled:true}")
    private boolean swaggerUiEnabled;

    /**
     * CORS izinli domain'ler — virgülle ayrılmış liste.
     * Dev: localhost:5173 (Vite). Prod: Vercel domain env var ile gelir.
     */
    @Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:3000}")
    private String allowedOrigins;

    /**
     * FAZ F.6 — HSTS sadece HTTPS prod ortaminda anlamli; localhost'ta TLS yokken
     * browser bu domain'i HTTPS-only isaretler ve 1 yil dev'i bozar. Default true
     * (Railway prod), local override icin app.security.hsts-enabled=false.
     */
    @Value("${app.security.hsts-enabled:true}")
    private boolean hstsEnabled;

    /** Virgulle ayrilmis origin listesi: trim + bos girdiler atilir (CORS ve WebSocket ortak). */
    public static List<String> parseOrigins(String csv) {
        if (csv == null) return List.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .toList();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // Liste "a, b" yazilsa da eslessin: bosluklar ve bos girdiler atilir
        config.setAllowedOrigins(parseOrigins(allowedOrigins));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Authorization", "Content-Disposition"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // CSRF disable — stateless REST API + JWT (Authorization header).
                // Token localStorage'da, otomatik gönderim cookie ile değil (axios
                // interceptor); third-party site bizim adımıza istek atamaz → CSRF
                // saldırı vektörü yok. Bu mantık COOKIE-BASED refresh token'a
                // geçtiğimiz an YENİDEN değerlendirilmeli (CsrfTokenRepository +
                // double-submit pattern eklenir). Şu an guard: tek source = chrome.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                // FAZ D.3 — Security headers
                .headers(headers -> headers
                        // HSTS — HTTPS-only (Railway prod TLS terminator: zaten zorunlu,
                        // header sub-domain'lere yayılır). FAZ F.6: dev override.
                        .httpStrictTransportSecurity(hsts -> {
                            if (hstsEnabled) {
                                hsts.includeSubDomains(true).maxAgeInSeconds(31_536_000L);
                            } else {
                                hsts.disable();
                            }
                        })
                        // X-Frame-Options: DENY — clickjacking koruması
                        .frameOptions(HeadersConfigurer.FrameOptionsConfig::deny)
                        // Referrer-Policy: origin-only (path/query leak'i önler)
                        .referrerPolicy(ref -> ref.policy(
                                ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        // CSP: API JSON response icin minimal (defansif derinlik).
                        // Frontend HTML Vercel'de servis edilir, kendi CSP'si var.
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"))
                        // Permissions-Policy: hassas API'leri varsayilan kapali.
                        // Spring Security 6.2'de DSL ismi version'a gore degisiyor,
                        // basit ve sabit yontem: HeaderWriter ile.
                        .addHeaderWriter((req, res) -> res.setHeader(
                                "Permissions-Policy",
                                "camera=(), microphone=(), geolocation=(self), payment=()"))
                )
                .authorizeHttpRequests(auth -> auth
                        // Hata yönlendirmesi (sendError → /error) kendi başına yetki istemesin:
                        // yoksa 403/404 gibi yanıtlar ERROR dispatch'te girişsiz sayılıp 401'e
                        // dönüşebiliyordu (JWT filtresi hata dispatch'inde çalışmaz).
                        .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll()
                        .requestMatchers(docPaths(apiDocsEnabled, swaggerUiEnabled)).permitAll()
                        // FAZ 9.1 — POST /api/listings/{id}/view anonim (landing SEO + widget).
                        // Rate-limit filter view spam'ini engeller. AUTH gerektiren
                        // diger /api/listings/** endpoint'lerinden (detail, my, salary-benchmark)
                        // once tanimli olmasi lazim; Spring Security first-match uygular.
                        .requestMatchers(HttpMethod.POST, "/api/listings/*/view").permitAll()
                        // FAZ 16 — Benzer ilanlar public (landing/SEO — auth gerektirmez)
                        .requestMatchers(HttpMethod.GET, "/api/listings/*/similar").permitAll()
                        .requestMatchers(
                                "/api/auth/**",
                                "/api/businesses/**",
                                "/api/businesses",
                                "/api/listings",
                                "/oauth2/**",              // #92: Google OAuth flow
                                "/login/oauth2/**",         // #92: Google callback
                                "/ws/**",                   // FAZ 1/#12 — WS handshake (auth STOMP CONNECT'te yapilir)
                                "/api/push/vapid-public-key",// FAZ 1/#23 — public VAPID key (subscribe oncesi)
                                "/actuator/health",          // FAZ 2/#18 — basic health check (public)
                                "/actuator/health/**",       // FAZ 4.2 — liveness + readiness probes
                                "/actuator/info",             // FAZ 2/#18 — info (public, hassas degil)
                                "/api/dev/**",               // FAZ 4.4 — DEV-only test (@Profile("dev"))
                                "/api/public/**",            // FAZ G.8 — landing pulse + public widget'lar
                                "/api/billing/callback",     // Faz 1 — iyzico odeme callback'i (iyzico sunucusu POST eder)
                                "/sitemap.xml",              // FAZ 11.W4.3 — SEO crawl
                                "/robots.txt"                // FAZ 11.W4.3
                        ).permitAll()
                        // metrics/prometheus/circuitbreakers/flyway vb. yalniz ADMIN
                        // (health/info ozetleri yukarida public; detayli health
                        // management.endpoint.health.roles=ADMIN ile yalniz admine).
                        .requestMatchers("/actuator/**").hasRole("ADMIN")
                        .requestMatchers("/api/candidate/**").hasRole("CANDIDATE")
                        .requestMatchers("/api/business/**").hasRole("BUSINESS_OWNER")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                // FIX: token'siz/expired /api/** cagrisi eskiden oauth2Login'in
                // login-url entry point'ine 302 (→ /oauth2/authorization/google)
                // donuyordu. JWT SPA icin yanlis: axios reactive-refresh yalnizca
                // 401'de tetikleniyor, 302'yi (cross-origin OAuth'a follow → CORS)
                // yakalayamadigi icin sessiz refresh KIRILIYORDU. /api/** artik 401
                // (JSON) doner; OAuth redirect yalnizca tarayici rotalarinda kalir.
                // Girişli ama rolü yetmeyen istek → 403 + JSON (Türkçe). Girişsiz → 401 kalır;
                // frontend yalnız 401'de oturum yenilemeyi dener, 403'te denemez.
                .exceptionHandling(ex -> ex
                        .defaultAuthenticationEntryPointFor(
                                new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED),
                                PathPatternRequestMatcher.withDefaults().matcher("/api/**"))
                        .accessDeniedHandler(jsonAccessDeniedHandler()))
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                .authenticationProvider(authenticationProvider)
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(rateLimitFilter, JwtAuthFilter.class)
                // FAZ D.2 — JWT'den SONRA: SecurityContext set edilmis olur
                .addFilterAfter(idempotencyFilter, JwtAuthFilter.class)

                // #92: Google OAuth2 login flow
                .oauth2Login(oauth -> oauth
                        .userInfoEndpoint(userInfo -> userInfo.userService(oAuth2UserService))
                        .successHandler(oAuth2SuccessHandler)
                );

        return http.build();
    }

    /** Swagger yolları: yalnız ilgili springdoc bileşeni açıksa izinli listeye girer. */
    static String[] docPaths(boolean apiDocsEnabled, boolean swaggerUiEnabled) {
        List<String> paths = new java.util.ArrayList<>();
        if (apiDocsEnabled) paths.add("/v3/api-docs/**");
        if (swaggerUiEnabled) {
            paths.add("/swagger-ui/**");
            paths.add("/swagger-ui.html");
        }
        // requestMatchers boş dizi kabul etmez; eşleşmeyecek sabit bir yol kullan
        if (paths.isEmpty()) paths.add("/__docs-disabled__");
        return paths.toArray(String[]::new);
    }

    /**
     * Spring varsayılanı sendError(403) yapıyordu: gövde yok ve ERROR dispatch'inde
     * yanıt girişsiz/401'e dönüşebiliyordu. Burada doğrudan 403 + JSON yazılır.
     */
    org.springframework.security.web.access.AccessDeniedHandler jsonAccessDeniedHandler() {
        return (request, response, ex) -> {
            if (response.isCommitted()) return;
            java.util.Map<String, Object> body = new java.util.LinkedHashMap<>();
            body.put("timestamp", java.time.LocalDateTime.now().toString());
            body.put("status", HttpStatus.FORBIDDEN.value());
            body.put("error", HttpStatus.FORBIDDEN.getReasonPhrase());
            body.put("message", messages.get("error.access.denied"));
            response.setStatus(HttpStatus.FORBIDDEN.value());
            response.setContentType(org.springframework.http.MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(java.nio.charset.StandardCharsets.UTF_8.name());
            objectMapper.writeValue(response.getOutputStream(), body);
        };
    }
}
