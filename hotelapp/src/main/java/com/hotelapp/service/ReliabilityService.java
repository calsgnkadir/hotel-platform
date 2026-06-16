package com.hotelapp.service;

import com.hotelapp.repository.ApplicationRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Aday güvenilirlik skoru (Reliability Score).
 *
 * Formül (0-100, clamp edilmiş):
 *   60                              baseline
 *   + (avgRating - 3) * 10          5★ = +20, 3★ = 0, 1★ = -20
 *   - noShowCount * 25              her no-show -25
 *   + min(20, completedLast90d * 2) son 90 günde tamamlanmış iş bonusu (max +20)
 *
 * Skor neyi söyler: aday geçmişte söz verdiği işe geldi mi, otelden ne aldı,
 * son zamanlarda aktif mi. İşletme paneli aday seçerken hızlı bir filtre olarak,
 * adayın kendi paneli neyi iyileştireceğini görmek için kullanır.
 */
@Service
@RequiredArgsConstructor
public class ReliabilityService {

    private final ApplicationRepository applicationRepository;
    private final ReviewService reviewService;

    @Transactional(readOnly = true)
    public ReliabilityScore computeForCandidate(Long candidateId) {
        long noShowCount = applicationRepository.countByCandidateIdAndNoShowTrue(candidateId);
        long completedLast90d = applicationRepository.countCompletedAcceptedSince(
                candidateId, LocalDateTime.now().minusDays(90));
        var rating = reviewService.getCandidateRating(candidateId);
        Double avg = rating.getAverageRating();

        int score = 60;
        if (avg != null) {
            score += (int) Math.round((avg - 3.0) * 10);
        }
        score -= (int) (noShowCount * 25);
        score += (int) Math.min(20, completedLast90d * 2);
        if (score < 0) score = 0;
        if (score > 100) score = 100;

        return ReliabilityScore.builder()
                .score(score)
                .noShowCount((int) noShowCount)
                .completedJobsLast90d((int) completedLast90d)
                .averageRating(avg)
                .reviewCount(rating.getReviewCount())
                .build();
    }

    @Data
    @Builder
    public static class ReliabilityScore {
        private Integer score;
        private Integer noShowCount;
        private Integer completedJobsLast90d;
        private Double averageRating;
        private Long reviewCount;
    }
}
