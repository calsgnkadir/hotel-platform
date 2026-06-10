package com.hotelapp.controller;

import com.hotelapp.dto.AuthResponse;
import com.hotelapp.dto.LoginRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.entity.User;
import com.hotelapp.service.AuthService;
import com.hotelapp.service.AuthService.ChangePasswordRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "1. Auth", description = "Kayıt, giriş, refresh, logout — token mekanizması")
public class AuthController {

    private final AuthService authService;

    /** Cookie adı — frontend bilmek zorunda değil, tarayıcı otomatik gönderir */
    private static final String REFRESH_COOKIE = "refreshToken";

    /** F0.2 — Cookie'nin Secure flag'ı sadece prod'da (HTTPS) açık olmalı */
    @Value("${app.security.cookie-secure:false}")
    private boolean cookieSecure;

    /** F0.2 — SameSite politikası: Lax (cross-site cookie sızdırmaz) veya None (cross-origin için) */
    @Value("${app.security.cookie-samesite:Lax}")
    private String cookieSameSite;

    @Operation(summary = "Kayıt ol")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Kayıt başarılı"),
        @ApiResponse(responseCode = "422", description = "Email zaten kayıtlı")
    })
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletResponse response) {
        AuthResponse auth = authService.register(request);
        attachRefreshCookie(response, auth);
        return ResponseEntity.ok(auth);
    }

    @Operation(summary = "Giriş yap")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Giriş başarılı"),
        @ApiResponse(responseCode = "401", description = "Email veya şifre hatalı")
    })
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {
        AuthResponse auth = authService.login(request);
        attachRefreshCookie(response, auth);
        return ResponseEntity.ok(auth);
    }

    @Operation(summary = "Refresh token ile yeni access token al",
               description = "Refresh token cookie'den okunur. Yeni access + yeni refresh döner (rotation).")
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(HttpServletRequest request,
                                                 HttpServletResponse response) {
        String rawRefreshToken = readRefreshCookie(request);
        AuthResponse auth = authService.refresh(rawRefreshToken);
        attachRefreshCookie(response, auth);
        return ResponseEntity.ok(auth);
    }

    @Operation(summary = "Çıkış yap (refresh token iptal eder)")
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest request,
                                                       HttpServletResponse response) {
        String rawRefreshToken = readRefreshCookie(request);
        if (rawRefreshToken != null) authService.logout(rawRefreshToken);
        clearRefreshCookie(response);
        return ResponseEntity.ok(Map.of("message", "Çıkış yapıldı"));
    }

    @Operation(summary = "Şifre değiştir (D3)")
    @ApiResponses({
        @ApiResponse(responseCode = "422", description = "Mevcut şifre yanlış veya yeni şifre eskisiyle aynı")
    })
    @PutMapping("/change-password")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Map<String, String>> changePassword(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(currentUser.getId(), request);
        return ResponseEntity.ok(Map.of("message", "Şifreniz başarıyla değiştirildi"));
    }

    // ─── F0.2 Cookie helpers ─────────────────────────────────────────

    /**
     * Refresh token'i httpOnly cookie'ye koy + DTO'dan çıkar (body'den sızmasın).
     */
    private void attachRefreshCookie(HttpServletResponse response, AuthResponse auth) {
        if (auth.getRefreshToken() == null) return;

        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, auth.getRefreshToken())
                .httpOnly(true)           // JS'ten erişilemez (XSS koruması)
                .secure(cookieSecure)     // sadece HTTPS (prod)
                .sameSite(cookieSameSite) // Lax: same-site cookie default
                .path("/api/auth")        // SADECE /api/auth endpoint'lerine gider
                .maxAge(7 * 24 * 60 * 60) // 7 gün
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        // Refresh token body'den çıkar — frontend görmesin
        auth.setRefreshToken(null);
    }

    private String readRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie c : request.getCookies()) {
            if (REFRESH_COOKIE.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(REFRESH_COOKIE, "")
                .httpOnly(true)
                .secure(cookieSecure)
                .sameSite(cookieSameSite)
                .path("/api/auth")
                .maxAge(0)  // hemen sil
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
