package com.hotelapp.service;

import com.hotelapp.entity.*;
import com.hotelapp.enums.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.RepeatedTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.*;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.*;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.*;

/**
 * Yedek zinciri yarışları. Zincir kilidi ilan satırıdır (JobListingRepository.lockById):
 * <ul>
 *   <li>Aynı ilanda iki farklı gelmeyen için eşzamanlı teklif: iki teklif iki FARKLI
 *       yedeğe gitmeli (kilitsiz ikisi de 1. yedeği seçer; biri @Version ile düşer).</li>
 *   <li>Aynı boşluk için eşzamanlı iki zincir devamı: tek aktif teklif.</li>
 *   <li>Eşzamanlı iki yedek işaretleme: farklı sıra numaraları.</li>
 * </ul>
 */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import(StandbyService.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class StandbyConcurrencyTest {
    @Autowired StandbyService service;
    @Autowired EntityManager em;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean OutboxService outboxService;
    @MockitoBean NotificationService notificationService;
    @MockitoBean ApplicationMapper applicationMapper;
    @MockitoBean SmsService smsService;

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDate DAY = LocalDate.of(2026, 10, 3);

    /** Kurulum: ilan + 2 koltuklu yarınki slot + n yedek (teklifsiz) + 2 kabul edilmiş "gelmeyen". */
    private record Fixture(Long ownerId, Long listingId, Long slotId,
                           List<Long> noShowIds, List<Long> standbyIds, List<Long> pendingIds) {}

    private Fixture fixture(TransactionTemplate tx, int standbys, int pendings) {
        String tag = Long.toString(System.nanoTime());
        return tx.execute(status -> {
            User owner = User.builder().email("sb-owner-" + tag + "@test.com").password("x")
                    .fullName("Owner").role(Role.BUSINESS_OWNER).build();
            em.persist(owner);
            Business business = Business.builder().owner(owner).name("Otel").city("Istanbul")
                    .district("Sisli").type(BusinessType.RESTAURANT).build();
            em.persist(business);
            JobListing listing = JobListing.builder().business(business).title("Vardiya")
                    .description("test").position(Position.WAITER).jobType(JobType.PERMANENT)
                    .status(ListingStatus.ACTIVE).build();
            em.persist(listing);
            // İki gelmeyen boşalttı: 2 koltuk, 0 dolu
            ShiftSlot slot = ShiftSlot.builder().jobListing(listing).date(DAY.plusDays(1))
                    .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0))
                    .slotsNeeded(2).slotsFilled(0).build();
            em.persist(slot);

            Function<String, User> candidate = name -> {
                User c = User.builder().email("sb-" + name + "-" + tag + "@test.com").password("x")
                        .fullName(name).role(Role.CANDIDATE).build();
                em.persist(c);
                return c;
            };
            List<Long> noShows = new ArrayList<>(), sbs = new ArrayList<>(), pend = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                Application a = Application.builder().candidate(candidate.apply("noshow" + i))
                        .jobListing(listing).status(ApplicationStatus.ACCEPTED).deadline(DAY.atTime(23, 0))
                        .requestedSlots(new HashSet<>(Set.of(slot))).build();
                em.persist(a);
                noShows.add(a.getId());
            }
            for (int i = 0; i < standbys; i++) {
                Application a = Application.builder().candidate(candidate.apply("standby" + i))
                        .jobListing(listing).status(ApplicationStatus.STANDBY).standbyRank(i + 1)
                        .deadline(DAY.atTime(23, 0)).requestedSlots(new HashSet<>(Set.of(slot))).build();
                em.persist(a);
                sbs.add(a.getId());
            }
            for (int i = 0; i < pendings; i++) {
                Application a = Application.builder().candidate(candidate.apply("pending" + i))
                        .jobListing(listing).status(ApplicationStatus.PENDING).deadline(DAY.atTime(23, 0))
                        .requestedSlots(new HashSet<>(Set.of(slot))).build();
                em.persist(a);
                pend.add(a.getId());
            }
            em.flush();
            return new Fixture(owner.getId(), listing.getId(), slot.getId(), noShows, sbs, pend);
        });
    }

    /** İki görevi aynı anda başlatır; fırlatılan hataları döndürür (null = başarılı). */
    private List<Throwable> race(Callable<?> a, Callable<?> b) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
            List<Future<Throwable>> results = new ArrayList<>();
            for (Callable<?> task : List.of(a, b)) {
                results.add(executor.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                    try {
                        task.call();
                        return null;
                    } catch (Throwable t) {
                        return t;
                    }
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<Throwable> out = new ArrayList<>();
            for (Future<Throwable> f : results) out.add(f.get(30, TimeUnit.SECONDS));
            return out;
        } finally {
            executor.shutdownNow();
        }
    }

    private void fixClock() {
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(DAY.atTime(9, 0).atZone(TR).toInstant(), TR));
    }

    @RepeatedTest(5)
    void two_no_shows_on_same_listing_offer_to_two_different_standbys() throws Exception {
        fixClock();
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        Fixture f = fixture(tx, 2, 0);
        Long n1 = f.noShowIds().get(0), n2 = f.noShowIds().get(1);

        List<Throwable> errors = race(
                () -> service.offerAfterNoShow(n1, List.of(f.slotId())),
                () -> service.offerAfterNoShow(n2, List.of(f.slotId())));
        assertThat(errors).containsOnlyNulls();

        List<Long> replaces = tx.execute(st -> f.standbyIds().stream()
                .map(id -> em.find(Application.class, id))
                .map(Application::getStandbyReplacesApplicationId).toList());
        assertThat(replaces).as("her boşluğa ayrı yedek çağrılmalı").containsExactlyInAnyOrder(n1, n2);
    }

    @RepeatedTest(5)
    void two_chain_continuations_for_same_vacancy_leave_single_active_offer() throws Exception {
        fixClock();
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        Fixture f = fixture(tx, 3, 0);
        Long n1 = f.noShowIds().get(0);

        List<Throwable> errors = race(
                () -> service.offerAfterNoShow(n1),
                () -> service.offerAfterNoShow(n1));
        assertThat(errors).containsOnlyNulls();

        long active = tx.execute(st -> f.standbyIds().stream()
                .map(id -> em.find(Application.class, id))
                .filter(a -> a.getStandbyOfferedAt() != null && n1.equals(a.getStandbyReplacesApplicationId()))
                .count());
        assertThat(active).as("aynı boşluk için tek aktif teklif").isEqualTo(1);
    }

    @RepeatedTest(5)
    void concurrent_mark_as_standby_assigns_distinct_ranks() throws Exception {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        Fixture f = fixture(tx, 1, 2);
        Long p1 = f.pendingIds().get(0), p2 = f.pendingIds().get(1);

        List<Throwable> errors = race(
                () -> service.markAsStandby(p1, f.ownerId()),
                () -> service.markAsStandby(p2, f.ownerId()));
        assertThat(errors).containsOnlyNulls();

        List<Integer> ranks = tx.execute(st -> List.of(p1, p2).stream()
                .map(id -> em.find(Application.class, id).getStandbyRank()).toList());
        assertThat(ranks).as("mevcut 1. yedeğin ardından 2 ve 3").containsExactlyInAnyOrder(2, 3);
    }
}
