package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.service.ReportService;
import com.hotelapp.service.ReportService.CreateReportRequest;
import com.hotelapp.service.ReportService.ReportDto;
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

@RestController
@RequiredArgsConstructor
@Tag(name = "9. Şikayetler", description = "Kullanıcı şikayet oluşturma")
public class ReportController {

    private final ReportService reportService;

    @Operation(summary = "Şikayet oluştur — giriş yapmış herhangi bir kullanıcı")
    @PostMapping("/api/reports")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ReportDto> createReport(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @Valid @RequestBody CreateReportRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reportService.createReport(currentUser.getId(), request));
    }
}
