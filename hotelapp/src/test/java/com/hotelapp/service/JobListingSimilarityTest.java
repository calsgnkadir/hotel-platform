package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.Position;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FAZ 16 — JobListingQueryService.similarityScore pure fonksiyon testi.
 *
 * Content-based benzerlik: pozisyon +50, ilce +30 / komsu +15,
 * jobType +20, maas yakinligi +15/+8.
 */
class JobListingSimilarityTest {

    private static JobListing listing(Position pos, JobType type, String district, Integer smin, Integer smax) {
        JobListing l = new JobListing();
        l.setPosition(pos);
        l.setJobType(type);
        if (smin != null) l.setSalaryMin(BigDecimal.valueOf(smin));
        if (smax != null) l.setSalaryMax(BigDecimal.valueOf(smax));
        if (district != null) {
            Business b = new Business();
            b.setDistrict(district);
            l.setBusiness(b);
        }
        return l;
    }

    @Nested @DisplayName("Kategori katkilari")
    class Categories {
        @Test @DisplayName("Ayni pozisyon -> +50")
        void samePosition() {
            var a = listing(Position.WAITER, null, null, null, null);
            var b = listing(Position.WAITER, null, null, null, null);
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(50);
        }
        @Test @DisplayName("Farkli pozisyon -> 0")
        void diffPosition() {
            var a = listing(Position.WAITER, null, null, null, null);
            var b = listing(Position.RECEPTION, null, null, null, null);
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(0);
        }
        @Test @DisplayName("Ayni ilce -> +30")
        void sameDistrict() {
            var a = listing(null, null, "Besiktas", null, null);
            var b = listing(null, null, "Besiktas", null, null);
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(30);
        }
        @Test @DisplayName("Komsu ilce -> +15 (Besiktas-Sisli)")
        void neighborDistrict() {
            var a = listing(null, null, "Besiktas", null, null);
            var b = listing(null, null, "Sisli", null, null);
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(15);
        }
        @Test @DisplayName("Uzak ilce -> 0 (Besiktas-Tuzla)")
        void farDistrict() {
            var a = listing(null, null, "Besiktas", null, null);
            var b = listing(null, null, "Tuzla", null, null);
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(0);
        }
        @Test @DisplayName("Ayni jobType -> +20")
        void sameJobType() {
            var a = listing(null, JobType.DAILY, null, null, null);
            var b = listing(null, JobType.DAILY, null, null, null);
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(20);
        }
    }

    @Nested @DisplayName("Maas yakinligi")
    class SalaryProximity {
        @Test @DisplayName("%25 icinde -> +15 (100 vs 110)")
        void within25() {
            var a = listing(null, null, null, 100, 100);
            var b = listing(null, null, null, 110, 110);
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(15);
        }
        @Test @DisplayName("%25-50 arasi -> +8 (100 vs 140)")
        void within50() {
            var a = listing(null, null, null, 100, 100);
            var b = listing(null, null, null, 140, 140);
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(8);
        }
        @Test @DisplayName("%50+ fark -> 0 (100 vs 200)")
        void beyond50() {
            var a = listing(null, null, null, 100, 100);
            var b = listing(null, null, null, 200, 200);
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(0);
        }
        @Test @DisplayName("Maas yoksa katki yok")
        void noSalary() {
            var a = listing(Position.WAITER, null, null, null, null);
            var b = listing(Position.WAITER, null, null, 100, 100);
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(50);  // sadece pozisyon
        }
    }

    @Nested @DisplayName("Kombinasyon")
    class Combined {
        @Test @DisplayName("Tam benzer: pozisyon+ilce+jobType+maas = 115")
        void maxSimilar() {
            var a = listing(Position.WAITER, JobType.DAILY, "Besiktas", 100, 120);
            var b = listing(Position.WAITER, JobType.DAILY, "Besiktas", 105, 115);
            // 50 + 30 + 20 + 15 (maas ~%0 fark)
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(115);
        }
        @Test @DisplayName("Komsu ilce kombinasyonu: pozisyon+komsu+jobType = 85")
        void neighborCombo() {
            var a = listing(Position.WAITER, JobType.DAILY, "Besiktas", null, null);
            var b = listing(Position.WAITER, JobType.DAILY, "Sisli", null, null);
            // 50 + 15 + 20
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(85);
        }
        @Test @DisplayName("Hicbir ortak: 0")
        void noCommon() {
            var a = listing(Position.WAITER, JobType.DAILY, "Besiktas", 100, 100);
            var b = listing(Position.SECURITY, JobType.PERMANENT, "Tuzla", 500, 500);
            assertThat(JobListingQueryService.similarityScore(a, b)).isEqualTo(0);
        }
    }
}
