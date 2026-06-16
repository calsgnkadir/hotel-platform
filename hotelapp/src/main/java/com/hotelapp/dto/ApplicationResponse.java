package com.hotelapp.dto;

import com.hotelapp.enums.ApplicationStatus;
import lombok.Builder;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Data
@Builder
public class ApplicationResponse {

    private Long id;
    private ApplicationStatus status;
    private String coverLetter;
    private LocalDateTime deadline;
    private LocalDateTime createdAt;
    private String note;
    private boolean noShow;
    /** FAZ 2/#28: HOLD durumundaysa aday cevap deadline'i (24h) */
    private LocalDateTime holdDeadline;
    /** R5: tüm vardiyalar geçmişte mi (puanlanabilir mi) */
    private boolean workCompleted;
    /** #78: Aday bu başvuru için işletmeye puan verdi mi? */
    private boolean candidateReviewedBusiness;

    private CandidateSummary candidate;
    private ListingSummary listing;

    private List<AvailabilityDto> availabilities;
    private List<DocumentRequestDto> documentRequests;

    /** Faz E1: Adayın başvurduğu slot(lar) */
    private List<RequestedSlotDto> requestedSlots;

    /** Chat refactor v2: Başvuruyla otomatik açılan conversation ID — frontend mesajlaşmaya yönlendirir */
    private Long conversationId;

    @Data @Builder
    public static class CandidateSummary {
        private Long id;
        private String fullName;
        private String email;
        /** D7: Cloudinary CDN URL'i, null olabilir */
        private String avatarUrl;
        /** R3: adayın aldığı yorumların ortalaması (null = yok) ve sayısı */
        private Double averageRating;
        private Long reviewCount;
        /** Faz B/#11: 0-100 güvenilirlik skoru — işletme aday seçerken hızlı filtre. */
        private Integer reliabilityScore;
    }

    @Data @Builder
    public static class ListingSummary {
        private Long id;
        private String title;
        private String position;
        private String jobType;
        private Long businessId;
        private String businessName;
        private String businessType;
        /** #77: İşletme sahibinin user id'si — mesajlaşma başlatmak için. */
        private Long businessOwnerId;
    }

    @Data @Builder
    public static class AvailabilityDto {
        private DayOfWeek dayOfWeek;
        private LocalTime startTime;
        private LocalTime endTime;
    }

    @Data @Builder
    public static class DocumentRequestDto {
        private Long id;
        private String documentType;
        private String status;
        private LocalDateTime requestedAt;
    }

    /** Faz E1 */
    @Data @Builder
    public static class RequestedSlotDto {
        private Long id;
        private LocalDate date;
        private LocalTime startTime;
        private LocalTime endTime;
    }
}
