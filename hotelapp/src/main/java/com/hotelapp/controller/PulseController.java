package com.hotelapp.controller;

import com.hotelapp.service.PulseService;
import com.hotelapp.service.PulseService.PulseDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * FAZ G.8 — Landing pulse widget icin public REST initial state.
 * WS subscribe sonra /topic/pulse'i dinler.
 */
@RestController
@RequestMapping("/api/public/pulse")
@RequiredArgsConstructor
@Tag(name = "H. Platform Nabzı", description = "Landing canlı widget — herkese açık")
public class PulseController {

    private final PulseService pulseService;

    @Operation(summary = "Platform nabzı anlık snapshot")
    @GetMapping
    public ResponseEntity<PulseDto> snapshot() {
        return ResponseEntity.ok(pulseService.snapshot());
    }
}
