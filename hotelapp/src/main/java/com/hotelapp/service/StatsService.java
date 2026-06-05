package com.hotelapp.service;

import com.hotelapp.dto.StatsDtos.BucketDto;
import com.hotelapp.dto.StatsDtos.BusinessStatsDto;
import com.hotelapp.dto.StatsDtos.CandidateStatsDto;
import com.hotelapp.dto.StatsDtos.TrendPointDto;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.*;

/**
 * #88: Dashboard istatistikleri — aggregation servisi.
 * Trend serilerinde boş günler/aylar 0 ile doldurulur (frontend'in interpolation hesabı yapmasına gerek kalmaz).
 */
@Service
@RequiredArgsConstructor
public class StatsService {

    private final ApplicationRepository applicationRepository;
    private final JobListingRepository jobListingRepository;

    private static final int BUSINESS_TREND_DAYS = 30;
    private static final int CANDIDATE_TREND_MONTHS = 6;

    // ────────────────────────────────────────────────
    // BUSINESS
    // ────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public BusinessStatsDto getBusinessStats(Long ownerId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfMonth = now.withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        LocalDateTime startOfLastMonth = startOfMonth.minusMonths(1);

        long thisMonth = applicationRepository.countBusinessApplicationsInRange(ownerId, startOfMonth, now);
        long lastMonth = applicationRepository.countBusinessApplicationsInRange(ownerId, startOfLastMonth, startOfMonth);

        List<BucketDto> byStatus = toBuckets(
                applicationRepository.countBusinessApplicationsByStatus(ownerId));
        long total = byStatus.stream().mapToLong(BucketDto::getCount).sum();

        long accepted = bucketCount(byStatus, ApplicationStatus.ACCEPTED.name());
        long rejected = bucketCount(byStatus, ApplicationStatus.REJECTED.name());
        double acceptanceRate = total > 0 ? (double) accepted / total : 0.0;
        double rejectionRate  = total > 0 ? (double) rejected / total : 0.0;

        List<BucketDto> byPosition = toBuckets(
                applicationRepository.countBusinessApplicationsByPosition(ownerId));

        LocalDateTime trendSince = now.minusDays(BUSINESS_TREND_DAYS - 1).withHour(0).withMinute(0).withSecond(0);
        Map<LocalDate, Long> daily = toDateMap(
                applicationRepository.dailyApplicationCountForBusiness(ownerId, trendSince));
        List<TrendPointDto> dailyTrend = fillDailyTrend(daily, trendSince.toLocalDate(), BUSINESS_TREND_DAYS);

        long activeListings = jobListingRepository.countByBusiness_OwnerIdAndStatus(ownerId, ListingStatus.ACTIVE);

        return BusinessStatsDto.builder()
                .thisMonthApplications(thisMonth)
                .lastMonthApplications(lastMonth)
                .acceptanceRate(round2(acceptanceRate))
                .rejectionRate(round2(rejectionRate))
                .totalApplications(total)
                .activeListings(activeListings)
                .byPosition(byPosition)
                .byStatus(byStatus)
                .dailyTrend(dailyTrend)
                .build();
    }

    // ────────────────────────────────────────────────
    // CANDIDATE
    // ────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public CandidateStatsDto getCandidateStats(Long candidateId) {
        List<BucketDto> byStatus = toBuckets(
                applicationRepository.countCandidateApplicationsByStatus(candidateId));
        long total = byStatus.stream().mapToLong(BucketDto::getCount).sum();
        long accepted = bucketCount(byStatus, ApplicationStatus.ACCEPTED.name());
        double acceptanceRate = total > 0 ? (double) accepted / total : 0.0;

        Double avgSeconds = applicationRepository.avgResponseSecondsForCandidate(candidateId);
        Double avgHours = avgSeconds == null ? null : round2(avgSeconds / 3600.0);

        LocalDateTime trendSince = LocalDateTime.now()
                .minusMonths(CANDIDATE_TREND_MONTHS - 1L)
                .withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
        Map<String, Long> monthly = toMonthMap(
                applicationRepository.monthlyApplicationCountForCandidate(candidateId, trendSince));
        List<TrendPointDto> monthlyTrend = fillMonthlyTrend(monthly, YearMonth.from(trendSince), CANDIDATE_TREND_MONTHS);

        return CandidateStatsDto.builder()
                .totalApplications(total)
                .acceptanceRate(round2(acceptanceRate))
                .avgResponseHours(avgHours)
                .byStatus(byStatus)
                .monthlyTrend(monthlyTrend)
                .build();
    }

    // ────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────

    /** Object[]{enum/string, Long} → BucketDto listesi. */
    private List<BucketDto> toBuckets(List<Object[]> rows) {
        List<BucketDto> list = new ArrayList<>(rows.size());
        for (Object[] row : rows) {
            String key = row[0] == null ? "UNKNOWN" : row[0].toString();
            long count = ((Number) row[1]).longValue();
            list.add(new BucketDto(key, count));
        }
        return list;
    }

    private Map<LocalDate, Long> toDateMap(List<Object[]> rows) {
        Map<LocalDate, Long> m = new HashMap<>();
        for (Object[] row : rows) {
            LocalDate d = (LocalDate) row[0];
            m.put(d, ((Number) row[1]).longValue());
        }
        return m;
    }

    private Map<String, Long> toMonthMap(List<Object[]> rows) {
        Map<String, Long> m = new HashMap<>();
        for (Object[] row : rows) {
            m.put(row[0].toString(), ((Number) row[1]).longValue());
        }
        return m;
    }

    private long bucketCount(List<BucketDto> buckets, String key) {
        return buckets.stream()
                .filter(b -> key.equalsIgnoreCase(b.getKey()))
                .findFirst()
                .map(BucketDto::getCount)
                .orElse(0L);
    }

    /** Sürekli tarih serisi — boş günler 0 ile doldurulur. */
    private List<TrendPointDto> fillDailyTrend(Map<LocalDate, Long> data, LocalDate start, int days) {
        List<TrendPointDto> list = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate d = start.plusDays(i);
            list.add(TrendPointDto.builder()
                    .date(d)
                    .count(data.getOrDefault(d, 0L))
                    .build());
        }
        return list;
    }

    private List<TrendPointDto> fillMonthlyTrend(Map<String, Long> data, YearMonth start, int months) {
        List<TrendPointDto> list = new ArrayList<>(months);
        for (int i = 0; i < months; i++) {
            YearMonth ym = start.plusMonths(i);
            String key = ym.toString();  // "2026-06"
            list.add(TrendPointDto.builder()
                    .month(key)
                    .count(data.getOrDefault(key, 0L))
                    .build());
        }
        return list;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
