package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.Position;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * FAZ 6 — JobListingQueryService.scoreListing unit test.
 *
 * Weighted ranking formulu (FAZ 5 + FAZ 11.W4.2 sinyalleri):
 *  - position match          -> +50
 *  - odakli tercih (W4.2)    -> tek pozisyon +10, iki pozisyon +5 (match'e ek)
 *  - district match          -> +30
 *  - komsu ilce (W4.2)       -> tam eslesme yoksa +15
 *  - jobType match           -> +20
 *  - recency (30 gun icinde) -> lineer decay, max +10
 * Max: 120
 *
 * Scorer'in kendisi pure fonksiyon (state yok, side-effect yok), package-private
 * static — Spring context'e gerek yok. Ordering davranisi (Comparator behaviour)
 * ise integration test icin ayri iş.
 */
class JobListingQueryServiceRankingTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 7, 1, 12, 0);

    /* ── Yardimci factory ── */

    private static JobListing listing(Position pos, JobType jobType, String district, LocalDateTime createdAt) {
        JobListing l = new JobListing();
        l.setPosition(pos);
        l.setJobType(jobType);
        l.setCreatedAt(createdAt);
        if (district != null) {
            Business b = new Business();
            b.setDistrict(district);
            l.setBusiness(b);
        }
        return l;
    }

    @Nested @DisplayName("Kategori match skorlari")
    class MatchScores {

        @Test
        @DisplayName("Position match: +50 + tek-pozisyon odak bonusu +10")
        void positionMatchOnly() {
            JobListing l = listing(Position.WAITER, null, null, NOW);   // en yeni -> +10 recency
            int score = JobListingQueryService.scoreListing(
                    l,
                    Set.of(Position.WAITER),
                    null, null,
                    NOW);
            // 50 (position) + 10 (W4.2 odak: tek pozisyon) + 10 (recency)
            assertThat(score).isEqualTo(70);
        }

        @Test
        @DisplayName("District match tek basina +30 verir")
        void districtMatchOnly() {
            JobListing l = listing(null, null, "Besiktas", NOW);
            int score = JobListingQueryService.scoreListing(
                    l,
                    null,
                    Set.of("Besiktas"),
                    null,
                    NOW);
            // 30 + 10 recency
            assertThat(score).isEqualTo(40);
        }

        @Test
        @DisplayName("JobType match tek basina +20 verir")
        void jobTypeMatchOnly() {
            JobListing l = listing(null, JobType.DAILY, null, NOW);
            int score = JobListingQueryService.scoreListing(
                    l,
                    null, null,
                    Set.of(JobType.DAILY),
                    NOW);
            // 20 + 10 recency
            assertThat(score).isEqualTo(30);
        }

        @Test
        @DisplayName("Tum kategoriler match (tek pozisyon) -> 120 max")
        void allMatch() {
            JobListing l = listing(Position.WAITER, JobType.DAILY, "Besiktas", NOW);
            int score = JobListingQueryService.scoreListing(
                    l,
                    Set.of(Position.WAITER),
                    Set.of("Besiktas"),
                    Set.of(JobType.DAILY),
                    NOW);
            // 50 + 10 (odak) + 30 + 20 + 10 (recency)
            assertThat(score).isEqualTo(120);
        }

        @Test
        @DisplayName("Hicbir tercih yoksa score = sadece recency")
        void noPreferences() {
            JobListing l = listing(Position.WAITER, JobType.DAILY, "Besiktas", NOW);
            int score = JobListingQueryService.scoreListing(l, null, null, null, NOW);
            assertThat(score).isEqualTo(10);
        }

        @Test
        @DisplayName("Bos set tercih (kullanici baglami olsa da tercih girmemis) -> 0 puan bonus")
        void emptyPreferenceSets() {
            JobListing l = listing(Position.WAITER, JobType.DAILY, "Besiktas", NOW);
            int score = JobListingQueryService.scoreListing(
                    l,
                    Set.of(),
                    Set.of(),
                    Set.of(),
                    NOW);
            assertThat(score).isEqualTo(10);  // sadece recency
        }
    }

    @Nested @DisplayName("Recency decay davranisi")
    class RecencyDecay {

        @Test
        @DisplayName("Su an olusturulmus -> full +10")
        void justCreated() {
            JobListing l = listing(null, null, null, NOW);
            int score = JobListingQueryService.scoreListing(l, null, null, null, NOW);
            assertThat(score).isEqualTo(10);
        }

        @Test
        @DisplayName("15 gun once (yariya inmis) -> ~5")
        void fifteenDaysOld() {
            JobListing l = listing(null, null, null, NOW.minusDays(15));
            int score = JobListingQueryService.scoreListing(l, null, null, null, NOW);
            // 30g total; 15g kalan -> 10 * 15/30 = 5
            assertThat(score).isEqualTo(5);
        }

        @Test
        @DisplayName("30+ gun once -> 0 recency bonus")
        void olderThan30Days() {
            JobListing l = listing(null, null, null, NOW.minusDays(31));
            int score = JobListingQueryService.scoreListing(l, null, null, null, NOW);
            assertThat(score).isEqualTo(0);
        }

        @Test
        @DisplayName("createdAt null -> recency 0 (crash yok)")
        void nullCreatedAt() {
            JobListing l = listing(Position.WAITER, null, null, null);
            int score = JobListingQueryService.scoreListing(
                    l,
                    Set.of(Position.WAITER),
                    null, null,
                    NOW);
            // Position 50 + odak 10, recency skip
            assertThat(score).isEqualTo(60);
        }

        @Test
        @DisplayName("Gelecekte olusturulmus (saat dilimi bug) -> negatif olmaz, full +10")
        void futureCreatedAt() {
            JobListing l = listing(null, null, null, NOW.plusHours(1));
            int score = JobListingQueryService.scoreListing(l, null, null, null, NOW);
            // hoursOld negatif olurdu; scorer bunu 0'a clamp eder
            assertThat(score).isEqualTo(10);
        }
    }

    @Nested @DisplayName("Kismi match kombinasyonlari")
    class PartialMatches {

        @Test
        @DisplayName("Position match, district ve jobType farkli set'lerde -> sadece position bonus")
        void positionMatchOthersDontMatch() {
            JobListing l = listing(Position.WAITER, JobType.PERMANENT, "Kadikoy", NOW);
            int score = JobListingQueryService.scoreListing(
                    l,
                    Set.of(Position.WAITER),
                    Set.of("Besiktas"),        // farkli
                    Set.of(JobType.SEASONAL),  // farkli
                    NOW);
            // 50 (position) + 10 (odak) + 10 recency; Besiktas-Kadikoy komsu DEGIL -> district 0
            assertThat(score).isEqualTo(70);
        }

        @Test
        @DisplayName("Position + district match, jobType kayip -> 50+30+recency")
        void positionAndDistrict() {
            JobListing l = listing(Position.WAITER, JobType.PERMANENT, "Besiktas", NOW);
            int score = JobListingQueryService.scoreListing(
                    l,
                    Set.of(Position.WAITER),
                    Set.of("Besiktas"),
                    Set.of(JobType.SEASONAL),   // eslesme yok
                    NOW);
            assertThat(score).isEqualTo(50 + 10 + 30 + 10);  // +10 odak (W4.2)
        }

        @Test
        @DisplayName("Business null olsa da crash yok (edge case)")
        void nullBusiness() {
            JobListing l = listing(Position.WAITER, null, null, NOW);
            l.setBusiness(null);  // explicit — factory 'district=null' verirse zaten null
            int score = JobListingQueryService.scoreListing(
                    l,
                    Set.of(Position.WAITER),
                    Set.of("Besiktas"),
                    null,
                    NOW);
            // Position 50 + odak 10, district'te business null oldugu icin skip, recency +10
            assertThat(score).isEqualTo(70);
        }

        @Test
        @DisplayName("Business var ama district null -> sadece district bonus atlanir")
        void nullDistrictOnBusiness() {
            Business b = new Business();
            b.setDistrict(null);
            JobListing l = new JobListing();
            l.setBusiness(b);
            l.setPosition(Position.WAITER);
            l.setCreatedAt(NOW);
            int score = JobListingQueryService.scoreListing(
                    l,
                    Set.of(Position.WAITER),
                    Set.of("Besiktas"),
                    null,
                    NOW);
            assertThat(score).isEqualTo(70);  // 50 + 10 odak + 10 recency
        }
    }

    /* ── FAZ 11.W4.2 — Yeni sinyaller ── */

    @Nested @DisplayName("W4.2 — Komsu ilce + odakli tercih")
    class Wave4Signals {

        @Test
        @DisplayName("Komsu ilce: Besiktas tercihli aday, Sisli ilani -> +15")
        void neighborDistrictBonus() {
            JobListing l = listing(null, null, "Sisli", NOW);
            int score = JobListingQueryService.scoreListing(
                    l, null, Set.of("Besiktas"), null, NOW);
            // 15 (komsu) + 10 (recency)
            assertThat(score).isEqualTo(25);
        }

        @Test
        @DisplayName("Komsu olmayan ilce: Besiktas tercihli, Tuzla ilani -> 0 district puani")
        void nonNeighborNoBonus() {
            JobListing l = listing(null, null, "Tuzla", NOW);
            int score = JobListingQueryService.scoreListing(
                    l, null, Set.of("Besiktas"), null, NOW);
            assertThat(score).isEqualTo(10);  // sadece recency
        }

        @Test
        @DisplayName("Tam eslesme komsu bonusunu ezer (30, 15 degil)")
        void exactMatchBeatsNeighbor() {
            JobListing l = listing(null, null, "Sisli", NOW);
            int score = JobListingQueryService.scoreListing(
                    l, null, Set.of("Sisli", "Besiktas"), null, NOW);
            assertThat(score).isEqualTo(40);  // 30 tam + 10 recency
        }

        @Test
        @DisplayName("Turkce karakter normalize: 'Beşiktaş' tercihi 'Şişli' ilanina komsu")
        void turkishCharNormalization() {
            JobListing l = listing(null, null, "Şişli", NOW);
            int score = JobListingQueryService.scoreListing(
                    l, null, Set.of("Beşiktaş"), null, NOW);
            assertThat(score).isEqualTo(25);  // 15 komsu + 10 recency
        }

        @Test
        @DisplayName("Odak bonusu: 2 pozisyon secilmisse +5")
        void twoPositionFocusBonus() {
            JobListing l = listing(Position.WAITER, null, null, NOW);
            int score = JobListingQueryService.scoreListing(
                    l, Set.of(Position.WAITER, Position.RECEPTION), null, null, NOW);
            assertThat(score).isEqualTo(65);  // 50 + 5 + 10 recency
        }

        @Test
        @DisplayName("Odak bonusu: 3+ pozisyon secilmisse ek bonus yok")
        void threePlusPositionsNoBonus() {
            JobListing l = listing(Position.WAITER, null, null, NOW);
            int score = JobListingQueryService.scoreListing(
                    l,
                    Set.of(Position.WAITER, Position.RECEPTION, Position.SECURITY),
                    null, null, NOW);
            assertThat(score).isEqualTo(60);  // 50 + 0 + 10 recency
        }
    }

    @Nested @DisplayName("Sinif kontrolleri (regression)")
    class BoundaryChecks {

        @Test
        @DisplayName("Maksimum skor = 120 (tum kategoriler + odak + full recency)")
        void maxPossibleScore() {
            JobListing l = listing(Position.WAITER, JobType.DAILY, "Besiktas", NOW);
            int score = JobListingQueryService.scoreListing(
                    l,
                    Set.of(Position.WAITER),
                    Set.of("Besiktas"),
                    Set.of(JobType.DAILY),
                    NOW);
            assertThat(score).isLessThanOrEqualTo(120);
            assertThat(score).isEqualTo(120);
        }

        @Test
        @DisplayName("Minimum skor = 0 (hicbir match, 30+ gun eski)")
        void minPossibleScore() {
            JobListing l = listing(Position.WAITER, JobType.DAILY, "Kadikoy", NOW.minusDays(60));
            int score = JobListingQueryService.scoreListing(
                    l,
                    Set.of(Position.RECEPTION),  // farkli
                    Set.of("Besiktas"),
                    Set.of(JobType.SEASONAL),
                    NOW);
            assertThat(score).isEqualTo(0);
        }
    }
}
