package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.service.ReviewService;
import com.hotelapp.service.ReviewService.CreateReviewRequest;
import com.hotelapp.service.ReviewService.RatingSummary;
import com.hotelapp.service.ReviewService.ReviewDto;
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

@RestController
@RequiredArgsConstructor
@Tag(name = "11. Yorumlar", description = "Aday ↔ işletme karşılıklı puanlama")
public class ReviewController {

    private final ReviewService reviewService;

    @Operation(summary = "Bir başvuru için yorum oluştur (aday ya da işletme)")
    @PostMapping("/api/applications/{applicationId}/reviews")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<ReviewDto> create(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long applicationId,
            @Valid @RequestBody CreateReviewRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reviewService.createReview(applicationId, currentUser.getId(), request));
    }

    @Operation(summary = "Bir işletmenin aldığı yorumlar (public)")
    @GetMapping("/api/businesses/{id}/reviews")
    public ResponseEntity<List<ReviewDto>> businessReviews(@PathVariable Long id) {
        return ResponseEntity.ok(reviewService.getBusinessReviews(id));
    }

    @Operation(summary = "Bir adayın aldığı yorumlar — sadece BUSINESS_OWNER")
    @GetMapping("/api/candidates/{id}/reviews")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<ReviewDto>> candidateReviews(@PathVariable Long id) {
        return ResponseEntity.ok(reviewService.getCandidateReviews(id));
    }

    @Operation(summary = "İşletme puan özeti (ortalama + sayı)")
    @GetMapping("/api/businesses/{id}/rating")
    public ResponseEntity<RatingSummary> businessRating(@PathVariable Long id) {
        return ResponseEntity.ok(reviewService.getBusinessRating(id));
    }
}
