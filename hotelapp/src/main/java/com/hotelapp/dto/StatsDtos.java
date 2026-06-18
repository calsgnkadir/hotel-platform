package com.hotelapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

/**
 * #88: Dashboard istatistikleri için tüm DTO'lar tek dosyada.
 */
public class StatsDtos {

    /** Bir kategori (status/position) için sayım. Donut/bar chart input'u. */
    @Data @Builder @AllArgsConstructor @NoArgsConstructor
    public static class BucketDto {
        private String key;     // "ACCEPTED", "WAITER", vb.
        private long count;
    }

    /** Bir zaman serisi noktası — line chart input'u. */
    @Data @Builder @AllArgsConstructor @NoArgsConstructor
    public static class TrendPointDto {
        private LocalDate date;     // gün bazlı (business için son 30 gün)
        private String month;       // "2026-06" (aday için son 6 ay)
        private long count;
    }

    /**
     * FAZ C.3 — Recruitment funnel.
     * received >= reviewed >= accepted >= completed (cumulative).
     */
    @Data @Builder @AllArgsConstructor @NoArgsConstructor
    public static class FunnelDto {
        private long received;    // tum basvurular
        private long reviewed;    // PENDING haric (gorulmus)
        private long accepted;    // ACCEPTED + COMPLETED
        private long completed;   // is bitmis (no-show degil + reviewed)
    }

    /**
     * FAZ C.3 — Hire-time histogram bucket'i (createdAt -> reviewedAt suresi).
     * Sadece ACCEPTED basvurular icin hesaplanir.
     */
    @Data @Builder @AllArgsConstructor @NoArgsConstructor
    public static class HireTimeBucketDto {
        private String label;     // "<1g", "1-3g", "3-7g", ">7g"
        private long count;
    }

    /** İşletme dashboard'u için zengin stat paketi. */
    @Data @Builder @AllArgsConstructor @NoArgsConstructor
    public static class BusinessStatsDto {
        private long thisMonthApplications;
        private long lastMonthApplications;
        private double acceptanceRate;     // 0.0 – 1.0
        private double rejectionRate;
        private long totalApplications;
        private long activeListings;
        /** Pozisyona göre dağılım (en çok başvurulan üstte). */
        private List<BucketDto> byPosition;
        /** Status dağılımı (donut için). */
        private List<BucketDto> byStatus;
        /** Son 30 gün — günlük başvuru. */
        private List<TrendPointDto> dailyTrend;
        /** FAZ C.3 — Recruitment funnel. */
        private FunnelDto funnel;
        /** FAZ C.3 — Hire-time histogram (4 bucket). */
        private List<HireTimeBucketDto> hireTime;
    }

    /** Aday dashboard'u için zengin stat paketi. */
    @Data @Builder @AllArgsConstructor @NoArgsConstructor
    public static class CandidateStatsDto {
        private long totalApplications;
        private double acceptanceRate;
        /** İşletmenin yanıt vermesi için ortalama saat (PENDING→REVIEWING/ACCEPTED/REJECTED). */
        private Double avgResponseHours;   // null = veri yok
        /** Status dağılımı (donut). */
        private List<BucketDto> byStatus;
        /** Son 6 ay — aylık başvuru sayısı. */
        private List<TrendPointDto> monthlyTrend;
    }
}
