package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.service.CandidateProfileService;
import com.hotelapp.service.CandidateProfileService.CandidateProfileDto;
import com.hotelapp.service.CandidateProfileService.ProfileUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@Tag(name = "8. Aday Profili", description = "Aday kullanıcının kişisel profil bilgileri")
public class CandidateController {

    private final CandidateProfileService candidateProfileService;

    @Operation(summary = "Kendi profilim — sadece CANDIDATE")
    @GetMapping("/api/candidate/profile")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<CandidateProfileDto> getMyProfile(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(candidateProfileService.getMyProfile(currentUser.getId()));
    }

    @Operation(summary = "Profil güncelle — sadece CANDIDATE")
    @PutMapping("/api/candidate/profile")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<CandidateProfileDto> updateMyProfile(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody ProfileUpdateRequest request) {
        return ResponseEntity.ok(candidateProfileService.updateMyProfile(currentUser.getId(), request));
    }
}
