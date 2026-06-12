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

        // FAZ 2/#26 - 4 aspect verilmis ise rating'i ortalamalari yap
        Integer effectiveRating = req.getRating();
        if (req.getAspect1() != null && req.getAspect2() != null
                && req.getAspect3() != null && req.getAspect4() != null) {
            int sum = req.getAspect1() + req.getAspect2() + req.getAspect3() + req.getAspect4();
            effectiveRating = Math.round(sum / 4f);
        }

        Review review = Review.builder()
                .application(application)
                .byRole(byRole)
                .rating(effectiveRating)
                .aspect1(req.getAspect1())  // FAZ 2/#26
                .aspect2(req.getAspect2())
                .aspect3(req.getAspect3())
                .aspect4(req.getAspect4())
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

    /** #78: Aday bu başvuru için işletmeye puan verdi mi? */
    public boolean hasCandidateReviewedBusiness(Long applicationId) {
        return reviewRepository.findByApplicationIdAndByRole(applicationId, "CANDIDATE").isPresent();
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
                .aspect1(r.getAspect1())  // FAZ 2/#26
                .aspect2(r.getAspect2())
                .aspect3(r.getAspect3())
                .aspect4(r.getAspect4())
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
        // FAZ 2/#26 - 4 aspect (CANDIDATE: yonetim/odeme/calisma/ekip,
        // BUSINESS: devamlilik/caliskanlik/iletisim/tutum)
        private Integer aspect1;
        private Integer aspect2;
        private Integer aspect3;
        private Integer aspect4;
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
        // FAZ 2/#26: rating opsiyonel oldu (4 aspect doluysa ortalama hesaplanir)
        @Min(value = 1, message = "Puan en az 1 olmalı")
        @Max(value = 5, message = "Puan en fazla 5 olmalı")
        private Integer rating;

        // 4 boyut puanlama, hepsi opsiyonel (geri uyumluluk)
        @Min(1) @Max(5) private Integer aspect1;
        @Min(1) @Max(5) private Integer aspect2;
        @Min(1) @Max(5) private Integer aspect3;
        @Min(1) @Max(5) private Integer aspect4;

        private String comment;
    }
}
