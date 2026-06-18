package com.hotelapp.service;

import com.hotelapp.dto.StatsDtos.BusinessStatsDto;
import com.hotelapp.dto.StatsDtos.HireTimeBucketDto;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StatsServiceTest {

    @Mock private ApplicationRepository applicationRepository;
    @Mock private JobListingRepository jobListingRepository;
    @InjectMocks private StatsService service;

    private static final Long OWNER = 11L;

    /** byStatus + listing/range stub'lari default 0 — sade getBusinessStats() icin gerekli. */
    private void stubBaseline(List<Object[]> byStatus, List<Long> hireTimes) {
        when(applicationRepository.countBusinessApplicationsInRange(anyLong(), any(), any()))
                .thenReturn(0L);
        when(applicationRepository.countBusinessApplicationsByStatus(OWNER))
                .thenReturn(byStatus);
        when(applicationRepository.countBusinessApplicationsByPosition(OWNER))
                .thenReturn(List.of());
        when(applicationRepository.dailyApplicationCountForBusiness(anyLong(), any()))
                .thenReturn(List.of());
        when(jobListingRepository.countByBusiness_OwnerIdAndStatus(anyLong(), any()))
                .thenReturn(0L);
        when(applicationRepository.hireTimeSecondsForBusiness(OWNER))
                .thenReturn(hireTimes);
    }

    @Test
    @DisplayName("Funnel: byStatus'tan dogru turetilir (received/reviewed/accepted/completed)")
    void funnel_derivedFromByStatus() {
        // 10 PENDING + 5 ACCEPTED + 3 REJECTED = 18 total
        List<Object[]> byStatus = List.of(
                new Object[]{ApplicationStatus.PENDING,  10L},
                new Object[]{ApplicationStatus.ACCEPTED,  5L},
                new Object[]{ApplicationStatus.REJECTED,  3L}
        );
        stubBaseline(byStatus, List.of());

        BusinessStatsDto dto = service.getBusinessStats(OWNER);

        assertThat(dto.getFunnel()).isNotNull();
        assertThat(dto.getFunnel().getReceived()).isEqualTo(18);
        assertThat(dto.getFunnel().getReviewed()).isEqualTo(8);   // PENDING haric
        assertThat(dto.getFunnel().getAccepted()).isEqualTo(5);
        assertThat(dto.getFunnel().getCompleted()).isEqualTo(5);  // simdilik accepted = completed
    }

    @Test
    @DisplayName("Funnel: hic basvuru yok -> tum sayilar 0")
    void funnel_zeroData() {
        stubBaseline(List.of(), List.of());

        BusinessStatsDto dto = service.getBusinessStats(OWNER);

        assertThat(dto.getFunnel().getReceived()).isZero();
        assertThat(dto.getFunnel().getReviewed()).isZero();
        assertThat(dto.getFunnel().getAccepted()).isZero();
    }

    @Test
    @DisplayName("HireTime histogram: 4 bucket dogru sinirlarla doldurulur")
    void hireTime_bucketsCorrectly() {
        // Sinir test verisi:
        //   3600 s   (1 saat)   -> <1g
        //   86399 s  (~1g)      -> <1g (sinir = 86400)
        //   86400 s              -> 1-3g (sinir dahil sonraki bucket)
        //   200_000 s (~2.3g)    -> 1-3g
        //   300_000 s (~3.5g)    -> 3-7g
        //   1_000_000 s (~11.5g) -> >7g
        stubBaseline(List.of(), List.of(3600L, 86399L, 86400L, 200_000L, 300_000L, 1_000_000L));

        BusinessStatsDto dto = service.getBusinessStats(OWNER);

        assertThat(dto.getHireTime())
                .extracting(HireTimeBucketDto::getLabel, HireTimeBucketDto::getCount)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("<1g", 2L),
                        org.assertj.core.groups.Tuple.tuple("1-3g", 2L),
                        org.assertj.core.groups.Tuple.tuple("3-7g", 1L),
                        org.assertj.core.groups.Tuple.tuple(">7g", 1L)
                );
    }

    @Test
    @DisplayName("HireTime: bos veri -> tum bucket 0 ama label'lar yine var")
    void hireTime_emptyReturnsFourZeroBuckets() {
        stubBaseline(List.of(), List.of());

        BusinessStatsDto dto = service.getBusinessStats(OWNER);

        assertThat(dto.getHireTime()).hasSize(4);
        assertThat(dto.getHireTime()).allMatch(b -> b.getCount() == 0L);
    }

    @Test
    @DisplayName("Acceptance rate: 5/18 = 0.28 (round2)")
    void acceptanceRate_rounded() {
        List<Object[]> byStatus = List.of(
                new Object[]{ApplicationStatus.PENDING,  10L},
                new Object[]{ApplicationStatus.ACCEPTED,  5L},
                new Object[]{ApplicationStatus.REJECTED,  3L}
        );
        stubBaseline(byStatus, List.of());

        BusinessStatsDto dto = service.getBusinessStats(OWNER);

        assertThat(dto.getAcceptanceRate()).isEqualTo(0.28);
        assertThat(dto.getRejectionRate()).isEqualTo(0.17);
    }
}
