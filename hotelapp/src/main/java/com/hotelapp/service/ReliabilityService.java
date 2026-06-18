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
 *   60                                                  baseline
 *   + (avgRating - 3) * 10                              5★ = +20, 3★ = 0, 1★ = -20
 *   - round(50 * noShow / (noShow + completedAllTime))  ORAN BAZLI — flake oranı kadar ceza
 *   + min(20, completedLast90d * 2)                     son 90 günde aktivite bonusu
 *
 * Oran bazlı ceza şu mantığa dayanır: 4 no-show + 1 tamamlanmış iş = %80 ceza (-40);
 * 4 no-show + 20 tamamlanmış iş = %16 ceza (-8). Hem yeni adaya yumuşak, hem geçmişi
 * iyi olan adaya af tanır. Hiç geçmişi olmayan aday için ceza 0.
 */
@Service
@RequiredArgsConstructor
public class ReliabilityService {

    private final ApplicationRepository applicationRepository;
    private final ReviewService reviewService;

    /**
     * Bulk variant — birden fazla aday için hesaplama.
     * Hala her aday için 3 query'lik N+1 vardır ama service tarafı tek noktadan
     * çağırır. İlerde GROUP BY ile gerçek bulk query'lere donüşür.
     */
    @Transactional(readOnly = true)
    public java.util.Map<Long, ReliabilityScore> computeForCandidatesBulk(java.util.Collection<Long> candidateIds) {
        java.util.Map<Long, ReliabilityScore> map = new java.util.HashMap<>();
        if (candidateIds == null || candidateIds.isEmpty()) return map;
        for (Long id : candidateIds) {
            map.put(id, computeForCandidate(id));
        }
        return map;
    }

    @Transactional(readOnly = true)
    public ReliabilityScore computeForCandidate(Long candidateId) {
        long noShowCount = applicationRepository.countByCandidateIdAndNoShowTrue(candidateId);
        long completedAll = applicationRepository.countCompletedAcceptedAllTime(candidateId);
        long completedLast90d = applicationRepository.countCompletedAcceptedSince(
                candidateId, LocalDateTime.now().minusDays(90));
        var rating = reviewService.getCandidateRating(candidateId);
        Double avg = rating.getAverageRating();

        int score = 60;
        if (avg != null) {
            score += (int) Math.round((avg - 3.0) * 10);
        }
        // Oran bazlı no-show cezası: max -50, denominator yoksa 0
        long denom = noShowCount + completedAll;
        if (denom > 0) {
            score -= (int) Math.round(50.0 * noShowCount / denom);
        }
        score += (int) Math.min(20, completedLast90d * 2);
        if (score < 0) score = 0;
        if (score > 100) score = 100;

        return ReliabilityScore.builder()
                .score(score)
                .noShowCount((int) noShowCount)
                .completedJobsLast90d((int) completedLast90d)
                .completedJobsAllTime((int) completedAll)
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
        private Integer completedJobsAllTime;
        private Double averageRating;
        private Long reviewCount;
    }
}
