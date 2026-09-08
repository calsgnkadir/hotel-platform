package com.hotelapp.controller;

import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.BillingService;
import com.hotelapp.service.IyzicoClient;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

/**
 * Faz 1 — İşletme aboneliği uçları. İşçi tarafı ücretsiz olduğu için burada
 * yalnızca işletme (BUSINESS_OWNER) uçları var; callback iyzico'nun sunucusundan
 * geldiği için public.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billingService;

    @Operation(summary = "İşletmenin abonelik durumu (deneme yoksa otomatik açılır)")
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/business/billing")
    public BillingService.BillingStatus status(@AuthenticationPrincipal UserPrincipal me) {
        return billingService.statusForOwner(me.getId());
    }

    @Operation(summary = "iyzico hosted checkout başlat — token + ödeme sayfası döner")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/business/billing/checkout")
    public ResponseEntity<IyzicoClient.CheckoutInit> checkout(@AuthenticationPrincipal UserPrincipal me) {
        IyzicoClient.CheckoutInit init = billingService.startCheckout(me.getId());
        return init.ok() ? ResponseEntity.ok(init)
                         : ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(init);
    }

    @Operation(summary = "Aboneliği iptal et")
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/business/billing/cancel")
    public BillingService.BillingStatus cancel(@AuthenticationPrincipal UserPrincipal me) {
        return billingService.cancel(me.getId());
    }

    /**
     * iyzico ödeme sonucunu buraya POST eder (token form param). Public — auth yok.
     * Sonucu doğrulayıp kullanıcıyı frontend abonelik sayfasına 302 ile geri atarız.
     */
    @PostMapping("/billing/callback")
    public ResponseEntity<Void> callback(@RequestParam(name = "token", required = false) String token) {
        String redirect = billingService.handleCallback(token);
        return ResponseEntity.status(HttpStatus.FOUND).location(URI.create(redirect)).build();
    }
}
