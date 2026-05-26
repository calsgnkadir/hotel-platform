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
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Tag(name = "1. Auth", description = "Kayıt ve giriş — token gerektirmez")
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "Kayıt ol", description = "STUDENT veya HOTEL rolüyle yeni hesap oluşturur. Başarılı olursa JWT token döner.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Kayıt başarılı, token döndü"),
        @ApiResponse(responseCode = "400", description = "Validation hatası"),
        @ApiResponse(responseCode = "422", description = "Email zaten kayıtlı"),
        @ApiResponse(responseCode = "429", description = "Çok fazla istek (rate limit)")
    })
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @Operation(summary = "Giriş yap", description = "Email ve şifre ile giriş. Dönen token'ı diğer isteklerde Authorization: Bearer {token} header'ında gönder.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Giriş başarılı"),
        @ApiResponse(responseCode = "401", description = "Email veya şifre hatalı"),
        @ApiResponse(responseCode = "429", description = "Çok fazla istek (rate limit)")
    })
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @Operation(summary = "Şifre değiştir (D3)", description = "Giriş yapmış kullanıcı şifresini değiştirir.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Şifre başarıyla değişti"),
        @ApiResponse(responseCode = "422", description = "Mevcut şifre yanlış veya yeni şifre eskisiyle aynı"),
        @ApiResponse(responseCode = "400", description = "Validation hatası")
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
}
