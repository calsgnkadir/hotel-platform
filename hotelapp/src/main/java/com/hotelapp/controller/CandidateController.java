package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.service.CandidateProfileService;
import com.hotelapp.service.CandidateProfileService.CandidateProfileDto;
import com.hotelapp.service.CandidateProfileService.ProfileUpdateRequest;
import com.hotelapp.service.ReliabilityService;
import com.hotelapp.service.ReliabilityService.ReliabilityScore;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@Tag(name = "8. Aday Profili", description = "Aday kullanıcının kişisel profil bilgileri")
public class CandidateController {

    private final CandidateProfileService candidateProfileService;
    private final ReliabilityService reliabilityService;

    @Operation(summary = "Kendi profilim — sadece CANDIDATE")
    @GetMapping("/api/candidate/profile")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<CandidateProfileDto> getMyProfile(@AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        return ResponseEntity.ok(candidateProfileService.getMyProfile(currentUser.getId()));
    }

    @Operation(summary = "Profil güncelle — sadece CANDIDATE")
    @PutMapping("/api/candidate/profile")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<CandidateProfileDto> updateMyProfile(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @Valid @RequestBody ProfileUpdateRequest request) {
        return ResponseEntity.ok(candidateProfileService.updateMyProfile(currentUser.getId(), request));
    }

    @Operation(summary = "Profil fotoğrafı yükle/değiştir (D7) — sadece CANDIDATE")
    @PostMapping(value = "/api/candidate/avatar", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<CandidateProfileDto> uploadAvatar(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(candidateProfileService.uploadAvatar(currentUser.getId(), file));
    }

    @Operation(summary = "Profil fotoğrafını sil — sadece CANDIDATE")
    @DeleteMapping("/api/candidate/avatar")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> deleteAvatar(@AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        candidateProfileService.deleteAvatar(currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Güvenilirlik skorum + breakdown — sadece CANDIDATE")
    @GetMapping("/api/candidate/reliability")
    @PreAuthorize("hasRole('CANDIDATE')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ReliabilityScore> getMyReliability(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        return ResponseEntity.ok(reliabilityService.computeForCandidate(currentUser.getId()));
    }
}
