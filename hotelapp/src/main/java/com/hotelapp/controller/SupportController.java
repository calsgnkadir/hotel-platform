package com.hotelapp.controller;

import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.SupportTicketService;
import com.hotelapp.service.SupportTicketService.CreateRequest;
import com.hotelapp.service.SupportTicketService.TicketDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * FAZ I.5 — Kullanıcı destek kanalı.
 * Mevcut işletme↔aday mesajlaşmasından AYRI bir kanal (platform↔kullanıcı).
 */
@RestController
@RequestMapping("/api/me/support")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "I. Destek", description = "Kullanıcı ↔ platform destek bileti")
@PreAuthorize("isAuthenticated()")
public class SupportController {

    private final SupportTicketService supportService;

    @Operation(summary = "Yeni destek talebi aç (günde max 5)")
    @PostMapping
    public ResponseEntity<TicketDto> submit(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody CreateRequest req) {
        TicketDto dto = supportService.submit(currentUser.getId(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @Operation(summary = "Kendi taleplerimi listele")
    @GetMapping
    public ResponseEntity<List<TicketDto>> listMine(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(supportService.listMine(currentUser.getId()));
    }
}
