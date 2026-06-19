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
import org.springframework.security.config.http.SessionCreationPolicy;
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

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
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
                        .requestMatchers(
                                "/api/auth/**",
                                "/api/businesses/**",
                                "/api/businesses",
                                "/api/listings",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/oauth2/**",              // #92: Google OAuth flow
                                "/login/oauth2/**",         // #92: Google callback
                                "/ws/**",                   // FAZ 1/#12 — WS handshake (auth STOMP CONNECT'te yapilir)
                                "/api/push/vapid-public-key",// FAZ 1/#23 — public VAPID key (subscribe oncesi)
                                "/actuator/health",          // FAZ 2/#18 — basic health check (public)
                                "/actuator/health/**",       // FAZ 4.2 — liveness + readiness probes
                                "/actuator/info",             // FAZ 2/#18 — info (public, hassas degil)
                                "/api/dev/**",               // FAZ 4.4 — DEV-only test (@Profile("dev"))
                                "/api/public/**"             // FAZ G.8 — landing pulse + public widget'lar
                        ).permitAll()
                        .requestMatchers("/api/candidate/**").hasRole("CANDIDATE")
                        .requestMatchers("/api/business/**").hasRole("BUSINESS_OWNER")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
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
}
