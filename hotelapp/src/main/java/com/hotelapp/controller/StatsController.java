package com.hotelapp.controller;

import com.hotelapp.dto.StatsDtos.BusinessStatsDto;
import com.hotelapp.dto.StatsDtos.CandidateStatsDto;
import com.hotelapp.entity.User;
import com.hotelapp.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@Tag(name = "D. Dashboard İstatistikleri", description = "Genel bakış grafik/sayım verileri")
public class StatsController {

    private final StatsService statsService;

    @Operation(summary = "İşletme dashboard istatistikleri")
    @GetMapping("/api/business/stats")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<BusinessStatsDto> businessStats(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(statsService.getBusinessStats(currentUser.getId()));
    }

    @Operation(summary = "Aday dashboard istatistikleri")
    @GetMapping("/api/candidate/stats")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<CandidateStatsDto> candidateStats(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(statsService.getCandidateStats(currentUser.getId()));
    }
}
