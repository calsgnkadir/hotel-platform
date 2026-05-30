package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Review;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.ReviewRepository;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final ApplicationRepository applicationRepository;

    // ----------------------------------------------------------------
    // Yorum oluştur
    // ----------------------------------------------------------------
    @Transactional
    public ReviewDto createReview(Long applicationId, Long reviewerUserId, CreateReviewRequest req) {
        Application application = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));

        if (application.getStatus() != ApplicationStatus.ACCEPTED) {
            throw new BusinessRuleException(
                    "Sadece kabul edilmiş başvurular puanlanabilir. Mevcut durum: " + application.getStatus());
        }

        // Çalışma tamamlandı mı? (en son slot tarihi geçmiş olmalı)
        if (!isWorkCompleted(application)) {
            throw new BusinessRuleException(
                    "Çalışma henüz tamamlanmadı. Son vardiya gününden sonra puanlayabilirsiniz.");
        }

        // Sadece aday işletmeyi puanlar (tek yönlü). İşletme adayı puanlamaz.
        if (!application.getCandidate().getId().equals(reviewerUserId)) {
            throw new UnauthorizedException(
                    "Sadece aday yorum yapabilir — işletme aday puanlama özelliği kaldırıldı.");
        }
        String byRole = "CANDIDATE";

        // Aynı yönde mevcut yorum var mı?
        reviewRepository.findByApplicationIdAndByRole(applicationId, byRole).ifPresent(existing -> {
            throw new BusinessRuleException("Bu başvuru için zaten yorum yaptınız");
        });

        Review review = Review.builder()
                .application(application)
                .byRole(byRole)
                .rating(req.getRating())
                .comment(req.getComment())
                .createdAt(LocalDateTime.now())
                .build();

        reviewRepository.save(review);
        return toDto(review);
    }

    /**
     * Bir başvurudaki tüm vardiyalar geçmişte mi (çalışma tamamlandı mı)?
     * Slot yoksa (eski başvuru) tamamlandı sayılır (backward compat).
     * Public — ApplicationService toResponse'unda da kullanılır.
     */
    public boolean isWorkCompleted(Application application) {
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

    // ----------------------------------------------------------------
    // Listeleme — işletme/aday için aldığı yorumlar
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<ReviewDto> getBusinessReviews(Long businessId) {
        return reviewRepository.findReviewsForBusiness(businessId)
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<ReviewDto> getCandidateReviews(Long candidateId) {
        return reviewRepository.findReviewsForCandidate(candidateId)
                .stream().map(this::toDto).toList();
    }

    // ----------------------------------------------------------------
    // Aggregate — ortalama + sayı (public)
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public RatingSummary getBusinessRating(Long businessId) {
        return summarize(reviewRepository.aggregateForBusiness(businessId));
    }

    @Transactional(readOnly = true)
    public RatingSummary getCandidateRating(Long candidateId) {
        return summarize(reviewRepository.aggregateForCandidate(candidateId));
    }

    private RatingSummary summarize(Object[] row) {
        // Hibernate Object[] döndürür ama bazen aslında tek bir Object[] içeren array gelir
        if (row == null || row.length == 0) return RatingSummary.empty();
        Object[] data = row.length == 1 && row[0] instanceof Object[] ? (Object[]) row[0] : row;
        Double avg = (data[0] != null) ? ((Number) data[0]).doubleValue() : null;
        Long count = (data[1] != null) ? ((Number) data[1]).longValue() : 0L;
        return RatingSummary.builder()
                .averageRating(avg)
                .reviewCount(count)
                .build();
    }

    // ----------------------------------------------------------------
    // Mapping
    // ----------------------------------------------------------------
    private ReviewDto toDto(Review r) {
        Application app = r.getApplication();
        String reviewerName;
        String revieweeName;
        if ("CANDIDATE".equals(r.getByRole())) {
            reviewerName = app.getCandidate().getFullName();
            revieweeName = app.getJobListing().getBusiness().getName();
        } else {
            reviewerName = app.getJobListing().getBusiness().getName();
            revieweeName = app.getCandidate().getFullName();
        }
        return ReviewDto.builder()
                .id(r.getId())
                .applicationId(app.getId())
                .byRole(r.getByRole())
                .reviewerName(reviewerName)
                .revieweeName(revieweeName)
                .rating(r.getRating())
                .comment(r.getComment())
                .createdAt(r.getCreatedAt())
                .build();
    }

    // ----------------------------------------------------------------
    // DTOs
    // ----------------------------------------------------------------
    @Data @Builder
    public static class ReviewDto {
        private Long id;
        private Long applicationId;
        private String byRole;
        private String reviewerName;
        private String revieweeName;
        private Integer rating;
        private String comment;
        private LocalDateTime createdAt;
    }

    @Data @Builder
    public static class RatingSummary {
        private Double averageRating;  // null = yorum yok
        private Long reviewCount;

        public static RatingSummary empty() {
            return RatingSummary.builder().averageRating(null).reviewCount(0L).build();
        }
    }

    @Data
    public static class CreateReviewRequest {
        @NotNull(message = "Puan zorunlu")
        @Min(value = 1, message = "Puan en az 1 olmalı")
        @Max(value = 5, message = "Puan en fazla 5 olmalı")
        private Integer rating;
        private String comment;
    }
}
