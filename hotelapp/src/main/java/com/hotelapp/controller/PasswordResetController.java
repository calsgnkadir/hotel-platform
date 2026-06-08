package com.hotelapp.controller;

import com.hotelapp.service.PasswordResetService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * #80: Şifre sıfırlama endpoint'leri.
 *
 * Hepsi public (SecurityConfig.permitAll), JWT gerekmez.
 * Rate limit önemli — bucket4j zaten /api/auth/* için aktif.
 */
@RestController
@RequestMapping("/api/auth/password-reset")
@RequiredArgsConstructor
public class PasswordResetController {

    private final PasswordResetService service;

    /**
     * Şifre sıfırlama maili tetikler.
     * Email bilinmese bile 200 döner (enumeration koruması).
     */
    @PostMapping("/request")
    public ResponseEntity<Map<String, String>> requestReset(@Valid @RequestBody RequestPayload payload) {
        service.requestReset(payload.getEmail());
        return ResponseEntity.ok(Map.of(
                "message", "Eğer bu email kayıtlıysa, sıfırlama linki gönderildi."
        ));
    }

    /**
     * Token'ı doğrular. UI bunu reset form'unu açmadan önce çağırır.
     * Hata varsa 4xx + error mesajı; başarı varsa email döner.
     */
    @GetMapping("/validate")
    public ResponseEntity<Map<String, String>> validateToken(@RequestParam String token) {
        String email = service.validateToken(token);
        return ResponseEntity.ok(Map.of(
                "email", email,
                "message", "Token geçerli."
        ));
    }

    /** Token + yeni şifre ile sıfırlamayı tamamlar. */
    @PostMapping("/confirm")
    public ResponseEntity<Map<String, String>> confirmReset(@Valid @RequestBody ConfirmPayload payload) {
        service.confirmReset(payload.getToken(), payload.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "Şifreniz güncellendi."));
    }

    @Data
    public static class RequestPayload {
        @NotBlank @Email(message = "Geçerli bir email girin")
        private String email;
    }

    @Data
    public static class ConfirmPayload {
        @NotBlank
        private String token;

        @NotBlank
        @Size(min = 8, max = 128, message = "Şifre en az 8 karakter olmalı")
        private String newPassword;
    }
}
