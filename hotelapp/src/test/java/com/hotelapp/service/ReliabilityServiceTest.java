package com.hotelapp.service;

import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.service.ReliabilityService.ReliabilityScore;
import com.hotelapp.service.ReviewService.RatingSummary;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * ReliabilityService unit testleri — formül senaryolari.
 * Spring context yüklenmez, repository/review mock'lanir.
 */
@ExtendWith(MockitoExtension.class)
class ReliabilityServiceTest {

    @Mock private ApplicationRepository applicationRepository;
    @Mock private ReviewService reviewService;
    @InjectMocks private ReliabilityService reliabilityService;

    private static final Long CANDIDATE_ID = 42L;

    @BeforeEach
    void setupDefaults() {
        // Varsayilan: hicbiri yok. Her test override edebilir.
        when(reviewService.getCandidateRating(CANDIDATE_ID))
                .thenReturn(RatingSummary.builder().averageRating(null).reviewCount(0L).build());
    }

    @Test
    @DisplayName("Hiç veri yok: sadece 60 baseline döner")
    void noData_returnsBaseline() {
        stubCounts(0, 0, 0);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);

        assertThat(r.getScore()).isEqualTo(60);
        assertThat(r.getNoShowCount()).isZero();
        assertThat(r.getCompletedJobsAllTime()).isZero();
        assertThat(r.getAverageRating()).isNull();
    }

    @Test
    @DisplayName("5 yıldız ortalama: +20 bonus → 80")
    void perfectRating_addsTwenty() {
        stubCounts(0, 0, 0);
        stubRating(5.0, 10L);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);

        assertThat(r.getScore()).isEqualTo(80);
        assertThat(r.getAverageRating()).isEqualTo(5.0);
        assertThat(r.getReviewCount()).isEqualTo(10L);
    }

    @Test
    @DisplayName("1 yıldız ortalama: -20 ceza → 40")
    void terribleRating_subtractsTwenty() {
        stubCounts(0, 0, 0);
        stubRating(1.0, 3L);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);

        assertThat(r.getScore()).isEqualTo(40);
    }

    @Test
    @DisplayName("3 yıldız ortalama: nötr → 60")
    void mediumRating_noChange() {
        stubCounts(0, 0, 0);
        stubRating(3.0, 5L);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);

        assertThat(r.getScore()).isEqualTo(60);
    }

    @Test
    @DisplayName("Oran bazlı ceza: 4 no-show + 1 tamamlanmış = -40 → 22")
    void mostlyNoShow_heavyButNotMaxPenalty() {
        // noShowCount=4, completedAllTime=1, completedLast90d=1 (+2 bonus)
        stubCounts(4, 1, 1);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);
        // 60 - round(50*4/5) + 2 = 60 - 40 + 2 = 22
        assertThat(r.getScore()).isEqualTo(22);
    }

    @Test
    @DisplayName("Oran bazlı ceza: 4 no-show + 20 tamamlanmış = -8 → 72")
    void mostlyCompleted_lightPenalty() {
        stubCounts(4, 20, 0);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);
        // 60 - round(50*4/24) = 60 - 8 = 52, sonra +0 bonus = 52
        // Aslinda: 50.0*4/24 = 8.33 → round 8 → 60-8 = 52
        assertThat(r.getScore()).isEqualTo(52);
    }

    @Test
    @DisplayName("Sadece no-show, hiç completed yok: max -50 → 10")
    void onlyNoShow_capsAtFifty() {
        stubCounts(10, 0, 0);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);
        // 60 - 50 = 10
        assertThat(r.getScore()).isEqualTo(10);
    }

    @Test
    @DisplayName("Çok no-show + kötü rating: 0'a clamp")
    void worstCase_clampsToZero() {
        stubCounts(20, 0, 0);
        stubRating(1.0, 5L);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);
        // 60 - 20 - 50 = -10 → clamp 0
        assertThat(r.getScore()).isZero();
    }

    @Test
    @DisplayName("Çok yüksek aktivite: 100'e clamp")
    void bestCase_clampsToHundred() {
        // 5★ (+20) + 50 son 90 gün iş (+min 20) + no-show yok = 100
        stubCounts(0, 50, 50);
        stubRating(5.0, 100L);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);
        // 60 + 20 + 20 = 100, clamp 100
        assertThat(r.getScore()).isEqualTo(100);
    }

    @Test
    @DisplayName("Son 90 gün bonusu max +20 ile sınırlı")
    void recentActivityBonus_capsAtTwenty() {
        stubCounts(0, 100, 100);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);
        // 60 + min(20, 200) = 80, no rating
        assertThat(r.getScore()).isEqualTo(80);
    }

    @Test
    @DisplayName("4.5 yıldız: round((4.5-3)*10) = +15 → 75")
    void halfStarRating_roundsCorrectly() {
        stubCounts(0, 0, 0);
        stubRating(4.5, 8L);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);
        assertThat(r.getScore()).isEqualTo(75);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------
    private void stubCounts(long noShow, long completedAll, long completedLast90d) {
        when(applicationRepository.countByCandidateIdAndNoShowTrue(CANDIDATE_ID))
                .thenReturn(noShow);
        when(applicationRepository.countCompletedAcceptedAllTime(CANDIDATE_ID))
                .thenReturn(completedAll);
        when(applicationRepository.countCompletedAcceptedSince(eq(CANDIDATE_ID), any(LocalDateTime.class)))
                .thenReturn(completedLast90d);
    }

    private void stubRating(double avg, long count) {
        when(reviewService.getCandidateRating(CANDIDATE_ID))
                .thenReturn(RatingSummary.builder().averageRating(avg).reviewCount(count).build());
    }
}
