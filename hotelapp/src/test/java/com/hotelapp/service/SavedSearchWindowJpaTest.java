package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.SavedSearch;
import com.hotelapp.entity.User;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.BusinessBlockRepository;
import com.hotelapp.repository.CandidateBlockRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.SavedSearchRepository;
import com.hotelapp.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;

/**
 * Kayıtlı arama tarama penceresi gerçek JPQL ile (H2): (since, until] yarı açık aralık,
 * ardışık pencereler aynı ilanı iki kez döndürmez, en yeni yayın önce gelir. Yayın anı
 * COALESCE(publishedAt, createdAt): yeniden yayına alınan ilan sonraki pencerede görünür.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class SavedSearchWindowJpaTest {

    @Autowired private JobListingRepository listings;
    @Autowired private SavedSearchRepository savedSearches;
    @Autowired private EntityManager em;

    private static final LocalDateTime T = LocalDateTime.of(2026, 11, 25, 12, 0);
    private static final java.time.ZoneId TR = java.time.ZoneId.of("Europe/Istanbul");

    private JobListingQueryService queryService() {
        // findActivePublishedBetween yalnız repository'yi kullanır
        return new JobListingQueryService(listings, null, null);
    }

    private User user(Role role) {
        User u = User.builder().email("window-" + System.nanoTime() + "@example.test")
                .password("test-only").fullName("Test Kullanıcı").role(role).build();
        em.persist(u);
        return u;
    }

    private Business business() {
        Business b = Business.builder().name("Test Otel").type(BusinessType.HOTEL)
                .district("Sisli").owner(user(Role.BUSINESS_OWNER)).build();
        em.persist(b);
        return b;
    }

    private Long listing(Business b, String title, ListingStatus status, LocalDateTime createdAt) {
        return listing(b, title, status, createdAt, null);
    }

    private Long listing(Business b, String title, ListingStatus status,
                         LocalDateTime createdAt, LocalDateTime publishedAt) {
        JobListing l = JobListing.builder().business(b).title(title).description("Test")
                .position(Position.WAITER).jobType(JobType.DAILY).status(status).build();
        em.persist(l);
        em.flush();
        // createdAt @PrePersist ile "şimdi" atanır; pencere sınırlarını sınamak için sabitlenir
        em.createQuery("UPDATE JobListing l SET l.createdAt = :c, l.publishedAt = :p WHERE l.id = :id")
                .setParameter("c", createdAt).setParameter("p", publishedAt)
                .setParameter("id", l.getId()).executeUpdate();
        return l.getId();
    }

    private List<Long> window(LocalDateTime since, LocalDateTime until, String keyword) {
        return queryService().findActivePublishedBetween(since, until,
                        null, null, null, null, null, keyword, null, null)
                .stream().map(JobListing::getId).toList();
    }

    @Test
    void halfOpenWindow_adjacentScansNeverReturnSameListing() {
        Business b = business();
        Long atSince  = listing(b, "Garson sinirda", ListingStatus.ACTIVE, T);
        Long inside   = listing(b, "Garson icerde", ListingStatus.ACTIVE, T.plusMinutes(10));
        Long atUntil  = listing(b, "Garson ust sinir", ListingStatus.ACTIVE, T.plusMinutes(30));
        Long later    = listing(b, "Garson sonra", ListingStatus.ACTIVE, T.plusMinutes(31));
        listing(b, "Garson durdurulmus", ListingStatus.PAUSED, T.plusMinutes(20));
        em.clear();

        List<Long> first  = window(T, T.plusMinutes(30), null);
        List<Long> second = window(T.plusMinutes(30), T.plusMinutes(60), null);

        // En yeni önce; alt sınır hariç, üst sınır dahil; PAUSED ilan dönmez
        assertThat(first).containsExactly(atUntil, inside);
        assertThat(second).containsExactly(later);
        assertThat(first).doesNotContainAnyElementsOf(second).doesNotContain(atSince);
    }

    @Test
    void keywordFilterWithDistinctStillHonoursWindowAndOrder() {
        Business b = business();
        // "teras" pozisyon anahtar kelimesi değil: yalnız başlık eşleşmesi sayılır
        Long older = listing(b, "Teras ekibi eski", ListingStatus.ACTIVE, T.plusMinutes(5));
        Long newer = listing(b, "Teras ekibi yeni", ListingStatus.ACTIVE, T.plusMinutes(15));
        listing(b, "Lobi ekibi", ListingStatus.ACTIVE, T.plusMinutes(10));
        listing(b, "Teras ekibi pencere disi", ListingStatus.ACTIVE, T.plusMinutes(45));
        em.clear();

        assertThat(window(T, T.plusMinutes(30), "teras")).containsExactly(newer, older);
    }

    @Test
    void publishedAtWins_createdAtOnlyWhenPublishedAtMissing() {
        Business b = business();
        // Eski ilan pencerede yeniden yayına alındı -> pencerede
        Long republished = listing(b, "Garson yeniden", ListingStatus.ACTIVE,
                T.minusDays(10), T.plusMinutes(20));
        // createdAt pencerede ama yayın anı pencereden önce -> pencere dışı
        Long publishedBefore = listing(b, "Garson onceden", ListingStatus.ACTIVE,
                T.plusMinutes(5), T.minusMinutes(1));
        // publishedAt yok (V31 öncesi satır) -> createdAt geçerli
        Long legacy = listing(b, "Garson eski satir", ListingStatus.ACTIVE, T.plusMinutes(10), null);
        em.clear();

        assertThat(window(T, T.plusMinutes(30), null))
                .containsExactly(republished, legacy)
                .doesNotContain(publishedBefore);
        // Anahtar kelimeli (DISTINCT) yolda da aynı pencere ve sıra
        assertThat(window(T, T.plusMinutes(30), "garson")).containsExactly(republished, legacy);
    }

    /**
     * Uçtan uca: gerçek SavedSearchService + gerçek sorgu, yalnız bildirim taklit.
     * İlan yayınlanır -> bir kez bildirilir; durdurulur ve 24 saat içinde açılır ->
     * publishedAt ilerlemez, bildirim yok; 24 saat sonra yeniden açılır -> sonraki
     * pencerede bir kez daha bildirilir; sonraki tarama tekrar etmez.
     */
    @Test
    void republishedListing_matchesNextWindowOnce_cooldownPreventsSpam() {
        Business b = business();
        User candidate = user(Role.CANDIDATE);
        SavedSearch s = SavedSearch.builder().user(candidate).name("Garson")
                .position(Position.WAITER).createdAt(T.minusDays(1)).lastNotifiedAt(T).build();
        em.persist(s);
        Long id = listing(b, "Garson aranıyor", ListingStatus.ACTIVE, T.plusMinutes(10), T.plusMinutes(10));
        em.flush();
        em.clear();

        NotificationService notifications = mock(NotificationService.class);
        UserRepository users = mock(UserRepository.class);
        BusinessBlockRepository businessBlocks = mock(BusinessBlockRepository.class);
        CandidateBlockRepository candidateBlocks = mock(CandidateBlockRepository.class);
        SavedSearchService service = new SavedSearchService(savedSearches, users, queryService(),
                notifications, businessBlocks, candidateBlocks);

        java.util.function.Function<LocalDateTime, Integer> scanAt = at -> {
            service.clock = java.time.Clock.fixed(at.atZone(TR).toInstant(), TR);
            int n = service.notifyNewMatches(s.getId());
            em.flush();
            em.clear();
            return n;
        };
        java.util.function.BiConsumer<ListingStatus, LocalDateTime> setStatus = (status, at) -> {
            JobListing l = listings.findById(id).orElseThrow();
            if (status == ListingStatus.ACTIVE && l.getStatus() != ListingStatus.ACTIVE) {
                l.markPublished(at);
            }
            l.setStatus(status);
            em.flush();
            em.clear();
        };

        // 1) İlk yayın -> bildirim
        assertThat(scanAt.apply(T.plusMinutes(40))).isEqualTo(1);
        // 2) Durdur, sonraki tarama boş
        setStatus.accept(ListingStatus.PAUSED, T.plusHours(1));
        assertThat(scanAt.apply(T.plusMinutes(70))).isZero();
        // 3) 24 saat içinde yeniden aç: publishedAt ilerlemez, bildirim yok
        setStatus.accept(ListingStatus.ACTIVE, T.plusHours(2));
        assertThat(listings.findById(id).orElseThrow().getPublishedAt()).isEqualTo(T.plusMinutes(10));
        assertThat(scanAt.apply(T.plusHours(2).plusMinutes(30))).isZero();
        // 4) Durdur, 24 saat sonra yeniden aç: publishedAt ilerler, sonraki pencerede tek bildirim
        setStatus.accept(ListingStatus.PAUSED, T.plusHours(3));
        setStatus.accept(ListingStatus.ACTIVE, T.plusHours(26));
        assertThat(listings.findById(id).orElseThrow().getPublishedAt()).isEqualTo(T.plusHours(26));
        assertThat(scanAt.apply(T.plusHours(26).plusMinutes(30))).isEqualTo(1);
        // 5) Sonraki tarama aynı yayını tekrar bildirmez
        assertThat(scanAt.apply(T.plusHours(27))).isZero();

        verify(notifications, times(2)).notify(eq(candidate.getId()), eq(NotificationType.MATCHING_LISTING),
                any(), eq("Garson aranıyor"), eq("/listings/" + id));
        verifyNoMoreInteractions(notifications);
    }
}
