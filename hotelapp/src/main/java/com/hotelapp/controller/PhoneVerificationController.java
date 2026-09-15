package com.hotelapp.controller;

import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.PhoneVerificationService;
import com.hotelapp.service.PhoneVerificationService.PhoneStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Telefon doğrulama (OTP) — herhangi bir authenticated kullanıcı (aday/işletme).
 * Opsiyonel: kayıt akışını etkilemez, sadece "doğrulanmış" rozeti kazandırır.
 */
@RestController
@RequestMapping("/api/profile/phone")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "1. Auth", description = "Telefon doğrulama (OTP)")
public class PhoneVerificationController {

    private final PhoneVerificationService service;

    @Operation(summary = "Telefon doğrulama durumu (maskeli numara + verified)")
    @GetMapping("/status")
    public PhoneStatus status(@AuthenticationPrincipal UserPrincipal me) {
        return service.status(me.getId());
    }

    @Operation(summary = "Doğrulama kodu gönder (SMS; DEV MODE'da log'a düşer)")
    @PostMapping("/send-code")
    public PhoneStatus sendCode(@AuthenticationPrincipal UserPrincipal me) {
        return service.sendCode(me.getId());
    }

    @Operation(summary = "Kodu doğrula")
    @PostMapping("/verify")
    public PhoneStatus verify(@AuthenticationPrincipal UserPrincipal me, @RequestBody VerifyBody body) {
        return service.verify(me.getId(), body.code());
    }

    public record VerifyBody(String code) {}
}
