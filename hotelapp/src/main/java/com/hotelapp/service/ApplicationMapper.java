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

    /** İş kuralı saati: Türkiye yerel saati, JVM saat diliminden bağımsız (testte sabitlenebilir). */
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

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
                .noShowSlotIds(app.isNoShow() ? NoShowSlots.ids(app).stream().sorted().toList() : List.of())
                .holdDeadline(app.getHoldDeadline())  // FAZ 2/#28
                // FAZ C.1 — yedek aday alanlari
                .standbyRank(app.getStandbyRank())
                .standbyOfferedAt(app.getStandbyOfferedAt())
                .standbyDeadline(app.getStandbyDeadline())
                .standbyOfferActive(
                        app.getStatus() == com.hotelapp.enums.ApplicationStatus.STANDBY
                        && app.getStandbyOfferedAt() != null
                        && app.getStandbyDeadline() != null
                        && app.getStandbyDeadline().isAfter(java.time.LocalDateTime.now(clock)))
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

    /** Vardiya saatleri Türkiye yerel saati. */
    static final java.time.ZoneId ZONE = java.time.ZoneId.of("Europe/Istanbul");

    static boolean isWorkCompleted(Application application) {
        return isWorkCompleted(application, java.time.LocalDateTime.now(ZONE));
    }

    /**
     * Basvurudaki tum vardiyalar bitti mi (calisma tamamlandi mi)? Bitis ShiftWindow'dan:
     * gece vardiyasi ertesi gun biter. Saat bilgisi eksik eski slotta gun sonu esas alinir.
     * Slot yoksa (eski basvuru) tamamlandi sayilir (backward compat).
     */
    static boolean isWorkCompleted(Application application, java.time.LocalDateTime now) {
        if (application.getRequestedSlots() == null || application.getRequestedSlots().isEmpty()) {
            return true;
        }
        return application.getRequestedSlots().stream()
                .map(ApplicationMapper::endOf)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder())
                .map(latestEnd -> !now.isBefore(latestEnd))
                .orElse(true);
    }

    /** Slotun bitis ani; saatsiz eski slotta gunun sonu. */
    static java.time.LocalDateTime endOf(ShiftSlot s) {
        if (ShiftWindow.hasTimes(s)) return ShiftWindow.endAt(s);
        return s.getDate() != null ? s.getDate().plusDays(1).atStartOfDay() : null;
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
