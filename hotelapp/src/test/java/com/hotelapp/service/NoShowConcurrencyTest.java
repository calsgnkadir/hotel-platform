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

import static org.assertj.core.api.Assertions.*;

/**
 * Ceza puanı yarışı: aynı adayın iki FARKLI başvurusuna (iki ayrı işletme) aynı anda
 * "gelmedi" işareti. User @Version'sız olduğundan aday satırı kilidi olmadan iki
 * işaret de aynı eski değerden düşer ve bir ceza kaybolur. markNoShow aday satırını
 * kilitler (aday → başvuru → slot); iki ceza da sayılmalı.
 */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import(ApplicationService.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class NoShowConcurrencyTest {
    @Autowired ApplicationService service;
    @Autowired EntityManager em;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean OutboxService outboxService;
    @MockitoBean NotificationService notificationService;
    @MockitoBean MessageService messageService;
    @MockitoBean EmailService emailService;
    @MockitoBean EmailTemplates emailTemplates;
    @MockitoBean ApplicationMapper applicationMapper;
    @MockitoBean StandbyService standbyService;
    @MockitoBean EmailVerificationPolicy emailVerificationPolicy;

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDate DAY = LocalDate.of(2026, 10, 3);

    @RepeatedTest(5)
    void concurrent_no_shows_on_two_applications_count_both_strikes() throws Exception {
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(DAY.atTime(9, 0).atZone(TR).toInstant(), TR));
        String tag = Long.toString(System.nanoTime());
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        Long[] ids = tx.execute(status -> {
            User candidate = User.builder().email("noshow-race-" + tag + "@test.com").password("x")
                    .fullName("Aday").role(Role.CANDIDATE).strikesRemaining(3).build();
            em.persist(candidate);
            List<Long> out = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                User owner = User.builder().email("noshow-owner-" + i + "-" + tag + "@test.com").password("x")
                        .fullName("Owner " + i).role(Role.BUSINESS_OWNER).build();
                em.persist(owner);
                Business business = Business.builder().owner(owner).name("Otel " + i).city("Istanbul")
                        .district("Sisli").type(BusinessType.RESTAURANT).build();
                em.persist(business);
                JobListing listing = JobListing.builder().business(business).title("Vardiya " + i)
                        .description("test").position(Position.WAITER).jobType(JobType.PERMANENT)
                        .status(ListingStatus.ACTIVE).build();
                em.persist(listing);
                // Farklı günlerdeki iki kabul (çakışma kuralı kabulde; burada önemsiz)
                ShiftSlot slot = ShiftSlot.builder().jobListing(listing).date(DAY.minusDays(i))
                        .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0))
                        .slotsNeeded(1).slotsFilled(1).build();
                em.persist(slot);
                Application app = Application.builder().candidate(candidate).jobListing(listing)
                        .status(ApplicationStatus.ACCEPTED).deadline(DAY.atTime(23, 0))
                        .requestedSlots(new HashSet<>(Set.of(slot))).build();
                em.persist(app);
                out.add(app.getId());
                out.add(slot.getId());
                out.add(owner.getId());
            }
            em.flush();
            out.add(candidate.getId());
            return out.toArray(new Long[0]);
        });

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
            List<Future<Throwable>> results = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                Long appId = ids[3 * i], slotId = ids[3 * i + 1], ownerId = ids[3 * i + 2];
                results.add(executor.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                    try {
                        service.markNoShow(appId, ownerId, slotId);
                        return null;
                    } catch (Throwable t) {
                        return t;
                    }
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(results.get(0).get(30, TimeUnit.SECONDS)).isNull();
            assertThat(results.get(1).get(30, TimeUnit.SECONDS)).isNull();

            Integer strikes = tx.execute(status ->
                    em.find(User.class, ids[6]).getStrikesRemaining());
            assertThat(strikes).as("iki gelmedi işareti iki ceza düşmeli").isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }
    }
}
