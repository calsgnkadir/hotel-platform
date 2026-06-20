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
     * Bulk variant — Dalga 3: gerçek bulk query'ler. 50 aday icin 3 GROUP BY +
     * 1 rating aggregate = 4 query toplam (eski: 150+).
     */
    @Transactional(readOnly = true)
    public java.util.Map<Long, ReliabilityScore> computeForCandidatesBulk(java.util.Collection<Long> candidateIds) {
        java.util.Map<Long, ReliabilityScore> map = new java.util.HashMap<>();
        if (candidateIds == null || candidateIds.isEmpty()) return map;

        // 3 sayim + 1 rating, hepsi GROUP BY
        java.util.Map<Long, Long> noShow   = toCountMap(applicationRepository.bulkCountNoShow(candidateIds));
        java.util.Map<Long, Long> compAll  = toCountMap(applicationRepository.bulkCountCompletedAllTime(candidateIds));
        java.util.Map<Long, Long> comp90d  = toCountMap(applicationRepository.bulkCountCompletedSince(
                candidateIds, LocalDateTime.now().minusDays(90)));
        java.util.Map<Long, ReviewService.RatingSummary> ratings =
                reviewService.getCandidateRatingsBulk(candidateIds);

        for (Long id : candidateIds) {
            long noShowCount      = noShow.getOrDefault(id, 0L);
            long completedAll     = compAll.getOrDefault(id, 0L);
            long completedLast90d = comp90d.getOrDefault(id, 0L);
            var rating = ratings.get(id);
            Double avg = (rating != null) ? rating.getAverageRating() : null;
            Long reviewCount = (rating != null) ? rating.getReviewCount() : 0L;
            map.put(id, scoreFrom(noShowCount, completedAll, completedLast90d, avg, reviewCount));
        }
        return map;
    }

    private static java.util.Map<Long, Long> toCountMap(java.util.List<Object[]> rows) {
        java.util.Map<Long, Long> m = new java.util.HashMap<>();
        for (Object[] row : rows) {
            if (row[0] != null) {
                m.put(((Number) row[0]).longValue(),
                      (row[1] != null) ? ((Number) row[1]).longValue() : 0L);
            }
        }
        return m;
    }

    private ReliabilityScore scoreFrom(long noShowCount, long completedAll, long completedLast90d,
                                       Double avg, Long reviewCount) {
        int score = 60;
        if (avg != null) score += (int) Math.round((avg - 3.0) * 10);
        long denom = noShowCount + completedAll;
        if (denom > 0) score -= (int) Math.round(50.0 * noShowCount / denom);
        score += (int) Math.min(20, completedLast90d * 2);
        if (score < 0)   score = 0;
        if (score > 100) score = 100;
        return ReliabilityScore.builder()
                .score(score)
                .noShowCount((int) noShowCount)
                .completedJobsLast90d((int) completedLast90d)
                .completedJobsAllTime((int) completedAll)
                .averageRating(avg)
                .reviewCount(reviewCount)
                .build();
    }

    @Transactional(readOnly = true)
    public ReliabilityScore computeForCandidate(Long candidateId) {
        long noShowCount = applicationRepository.countByCandidateIdAndNoShowTrue(candidateId);
        long completedAll = applicationRepository.countCompletedAcceptedAllTime(candidateId);
        long completedLast90d = applicationRepository.countCompletedAcceptedSince(
                candidateId, LocalDateTime.now().minusDays(90));
        var rating = reviewService.getCandidateRating(candidateId);
        return scoreFrom(noShowCount, completedAll, completedLast90d,
                rating.getAverageRating(), rating.getReviewCount());
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
