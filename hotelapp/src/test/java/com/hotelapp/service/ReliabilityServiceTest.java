package com.hotelapp.service;

import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.service.ReliabilityService.ReliabilityScore;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * ReliabilityService unit testleri — formül senaryolari.
 * Spring context yüklenmez, repository mock'lanir.
 */
@ExtendWith(MockitoExtension.class)
class ReliabilityServiceTest {

    @Mock private ApplicationRepository applicationRepository;
    @InjectMocks private ReliabilityService reliabilityService;

    private static final Long CANDIDATE_ID = 42L;

    @Test
    @DisplayName("Hiç veri yok: sadece 60 baseline döner")
    void noData_returnsBaseline() {
        stubCounts(0, 0, 0);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);

        assertThat(r.getScore()).isEqualTo(60);
        assertThat(r.getNoShowCount()).isZero();
        assertThat(r.getCompletedJobsAllTime()).isZero();
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
    @DisplayName("Oran bazlı ceza: 4 no-show + 20 tamamlanmış = -8 → 52")
    void mostlyCompleted_lightPenalty() {
        stubCounts(4, 20, 0);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);
        // 50.0*4/24 = 8.33 → round 8 → 60-8 = 52
        assertThat(r.getScore()).isEqualTo(52);
    }

    @Test
    @DisplayName("Sadece no-show, hiç completed yok: max -50 → 10")
    void onlyNoShow_capsAtFifty() {
        stubCounts(10, 0, 0);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);
        assertThat(r.getScore()).isEqualTo(10);
    }

    @Test
    @DisplayName("Son 90 gün bonusu max +20 ile sınırlı → 80")
    void recentActivityBonus_capsAtTwenty() {
        stubCounts(0, 100, 100);
        ReliabilityScore r = reliabilityService.computeForCandidate(CANDIDATE_ID);
        // 60 + min(20, 200) = 80
        assertThat(r.getScore()).isEqualTo(80);
    }

    @Test
    @DisplayName("Bulk: tekli hesapla ayni skor, verisi olmayan aday baseline")
    void bulk_matchesSingleFormula() {
        Long other = 43L;
        when(applicationRepository.bulkCountNoShow(anyCollection()))
                .thenReturn(List.<Object[]>of(new Object[]{CANDIDATE_ID, 4L}));
        when(applicationRepository.bulkCountCompletedAllTime(anyCollection()))
                .thenReturn(List.<Object[]>of(new Object[]{CANDIDATE_ID, 1L}));
        when(applicationRepository.bulkCountCompletedSince(anyCollection(), any(LocalDateTime.class)))
                .thenReturn(List.<Object[]>of(new Object[]{CANDIDATE_ID, 1L}));

        Map<Long, ReliabilityScore> map = reliabilityService.computeForCandidatesBulk(List.of(CANDIDATE_ID, other));

        assertThat(map.get(CANDIDATE_ID).getScore()).isEqualTo(22);
        assertThat(map.get(other).getScore()).isEqualTo(60);
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
}
