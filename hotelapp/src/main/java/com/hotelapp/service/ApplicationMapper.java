package com.hotelapp.service;

import com.hotelapp.dto.ApplicationResponse;
import com.hotelapp.dto.ApplicationResponse.RequestedSlotDto;
import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/**
 * FAZ 4.5 — Application <-> DTO donusum helper'i.
 * Eskiden ApplicationService'in icinde private metod'lardi; god class temizligi.
 * Stateless component, transaction yok (caller'in tx'inde calisir).
 */
@Component
@RequiredArgsConstructor
public class ApplicationMapper {

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
                // FAZ C.1 — yedek aday alanlari
                .standbyRank(app.getStandbyRank())
                .standbyOfferedAt(app.getStandbyOfferedAt())
                .standbyDeadline(app.getStandbyDeadline())
                .standbyOfferActive(
                        app.getStatus() == com.hotelapp.enums.ApplicationStatus.STANDBY
                        && app.getStandbyOfferedAt() != null
                        && app.getStandbyDeadline() != null
                        && app.getStandbyDeadline().isAfter(java.time.LocalDateTime.now()))
                .workCompleted(isWorkCompleted(app))
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
                .requestedSlots(slotDtos)
                // chat-v2: her basvuru icin (aday, isletme sahibi) eslesmesinin conversation ID'si
                .conversationId(conversationRepository
                        .findByCandidateIdAndBusinessOwnerId(
                                app.getCandidate().getId(),
                                business.getOwner().getId())
                        .map(c -> c.getId()).orElse(null))
                .build();
    }

    /**
     * Basvurudaki tum vardiyalar gecmiste mi (calisma tamamlandi mi)?
     * Slot yoksa (eski basvuru) tamamlandi sayilir (backward compat).
     */
    static boolean isWorkCompleted(Application application) {
        if (application.getRequestedSlots() == null || application.getRequestedSlots().isEmpty()) {
            return true;
        }
        LocalDate today = LocalDate.now();
        return application.getRequestedSlots().stream()
                .map(ShiftSlot::getDate)
                .max(Comparator.naturalOrder())
                .map(latest -> latest.isBefore(today))
                .orElse(true);
    }

    /** Aday ozeti — ad + avatar. */
    public ApplicationResponse.CandidateSummary buildCandidateSummary(User candidate) {
        return ApplicationResponse.CandidateSummary.builder()
                .id(candidate.getId())
                .fullName(candidate.getFullName())
                .email(candidate.getEmail())
                .avatarUrl(candidate.getAvatarPath() != null
                        ? fileStorageService.publicUrl(candidate.getAvatarPath())
                        : null)
                .build();
    }
}
