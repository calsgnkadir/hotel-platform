package com.hotelapp.service;

import com.hotelapp.dto.ApplicationResponse;
import com.hotelapp.dto.ApplicationResponse.RequestedSlotDto;
import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.User;
import com.hotelapp.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * FAZ 4.5 — Application <-> DTO donusum helper'i.
 * Eskiden ApplicationService'in icinde private metod'lardi; god class temizligi.
 * Stateless component, transaction yok (caller'in tx'inde calisir).
 */
@Component
@RequiredArgsConstructor
public class ApplicationMapper {

    private final ReviewService reviewService;
    private final FileStorageService fileStorageService;
    private final ConversationRepository conversationRepository;

    public ApplicationResponse toResponse(Application app) {
        List<ApplicationResponse.AvailabilityDto> avDtos = app.getAvailabilities().stream()
                .map(av -> ApplicationResponse.AvailabilityDto.builder()
                        .dayOfWeek(av.getDayOfWeek())
                        .startTime(av.getStartTime())
                        .endTime(av.getEndTime())
                        .build())
                .toList();

        List<ApplicationResponse.DocumentRequestDto> drDtos = app.getDocumentRequests().stream()
                .map(dr -> ApplicationResponse.DocumentRequestDto.builder()
                        .id(dr.getId())
                        .documentType(dr.getDocumentType().name())
                        .status(dr.getStatus().name())
                        .requestedAt(dr.getRequestedAt())
                        .build())
                .toList();

        // Faz E1: Adayin basvurdugu slotlar (tarih+saate gore sirali)
        List<RequestedSlotDto> slotDtos = (app.getRequestedSlots() == null) ? List.of()
                : app.getRequestedSlots().stream()
                    .sorted((a, b) -> {
                        int c = a.getDate().compareTo(b.getDate());
                        return c != 0 ? c : a.getStartTime().compareTo(b.getStartTime());
                    })
                    .map(s -> RequestedSlotDto.builder()
                            .id(s.getId())
                            .date(s.getDate())
                            .startTime(s.getStartTime())
                            .endTime(s.getEndTime())
                            .build())
                    .toList();

        JobListing listing = app.getJobListing();
        Business business = listing.getBusiness();

        return ApplicationResponse.builder()
                .id(app.getId())
                .status(app.getStatus())
                .coverLetter(app.getCoverLetter())
                .deadline(app.getDeadline())
                .createdAt(app.getCreatedAt())
                .note(app.getNote())
                .noShow(app.isNoShow())
                .holdDeadline(app.getHoldDeadline())  // FAZ 2/#28
                .workCompleted(reviewService.isWorkCompleted(app))
                .candidateReviewedBusiness(reviewService.hasCandidateReviewedBusiness(app.getId()))
                .candidate(buildCandidateSummary(app.getCandidate()))
                .listing(ApplicationResponse.ListingSummary.builder()
                        .id(listing.getId())
                        .title(listing.getTitle())
                        .position(listing.getPosition().name())
                        .jobType(listing.getJobType().name())
                        .businessId(business.getId())
                        .businessName(business.getName())
                        .businessType(business.getType().name())
                        .businessOwnerId(business.getOwner().getId())  // #77 mesajlasma
                        .build())
                .availabilities(avDtos)
                .documentRequests(drDtos)
                .requestedSlots(slotDtos)
                // chat-v2: her basvuru icin (aday, isletme sahibi) eslesmesinin conversation ID'si
                .conversationId(conversationRepository
                        .findByCandidateIdAndBusinessOwnerId(
                                app.getCandidate().getId(),
                                business.getOwner().getId())
                        .map(c -> c.getId()).orElse(null))
                .build();
    }

    /** Aday ozeti — avatar + rating dahil */
    public ApplicationResponse.CandidateSummary buildCandidateSummary(User candidate) {
        var rating = reviewService.getCandidateRating(candidate.getId());
        return ApplicationResponse.CandidateSummary.builder()
                .id(candidate.getId())
                .fullName(candidate.getFullName())
                .email(candidate.getEmail())
                .avatarUrl(candidate.getAvatarPath() != null
                        ? fileStorageService.publicUrl(candidate.getAvatarPath())
                        : null)
                .averageRating(rating.getAverageRating())
                .reviewCount(rating.getReviewCount())
                .build();
    }
}
