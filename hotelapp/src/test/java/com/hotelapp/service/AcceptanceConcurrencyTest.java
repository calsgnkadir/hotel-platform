package com.hotelapp.service;

import com.hotelapp.entity.*;
import com.hotelapp.enums.*;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.ApplicationRepository;
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
 * Kabul yarışı: aynı aday iki FARKLI ilandaki çakışan vardiya tekliflerini aynı anda
 * onaylar. Aday satırı kilidi (AcceptanceGuard.lockCandidate) iki kabulü sıraya sokar;
 * ikincisi birincinin ACCEPTED kaydını görür ve çakışma 422'si alır.
 */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import(ApplicationService.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class AcceptanceConcurrencyTest {
    @Autowired ApplicationService service;
    @Autowired ApplicationRepository applications;
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

    @RepeatedTest(3)
    void concurrent_hold_accepts_on_overlapping_shifts_only_one_wins() throws Exception {
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(DAY.atTime(6, 0).atZone(TR).toInstant(), TR));
        String tag = Long.toString(System.nanoTime());
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        Long[] ids = tx.execute(status -> {
            User candidate = User.builder().email("accept-race-" + tag + "@test.com").password("x")
                    .fullName("Aday").role(Role.CANDIDATE).build();
            em.persist(candidate);
            List<Long> out = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                User owner = User.builder().email("accept-owner-" + i + "-" + tag + "@test.com").password("x")
                        .fullName("Owner " + i).role(Role.BUSINESS_OWNER).build();
                em.persist(owner);
                Business business = Business.builder().owner(owner).name("Otel " + i).city("Istanbul")
                        .district("Sisli").type(BusinessType.RESTAURANT).build();
                em.persist(business);
                JobListing listing = JobListing.builder().business(business).title("Vardiya " + i)
                        .description("test").position(Position.WAITER).jobType(JobType.PERMANENT)
                        .status(ListingStatus.ACTIVE).build();
                em.persist(listing);
                // İki ilanda aynı gün çakışan saatler (08-16 ve 12-20)
                ShiftSlot slot = ShiftSlot.builder().jobListing(listing).date(DAY)
                        .startTime(LocalTime.of(8 + 4 * i, 0)).endTime(LocalTime.of(16 + 4 * i, 0)).build();
                em.persist(slot);
                Application app = Application.builder().candidate(candidate).jobListing(listing)
                        .status(ApplicationStatus.HELD).holdDeadline(DAY.atTime(23, 0))
                        .deadline(DAY.atTime(23, 0))
                        .requestedSlots(new HashSet<>(Set.of(slot))).build();
                em.persist(app);
                out.add(app.getId());
            }
            em.flush();
            return new Long[] {out.get(0), out.get(1), candidate.getId()};
        });

        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
            List<Future<Throwable>> results = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                Long appId = ids[i];
                results.add(executor.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                    try {
                        service.respondToHold(appId, ids[2], true);
                        return null;
                    } catch (Throwable t) {
                        return t;
                    }
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            Throwable first = results.get(0).get(30, TimeUnit.SECONDS);
            Throwable second = results.get(1).get(30, TimeUnit.SECONDS);

            List<Throwable> failures = new ArrayList<>();
            if (first != null) failures.add(first);
            if (second != null) failures.add(second);
            assertThat(failures).as("tam olarak bir kabul reddedilmeli").hasSize(1);
            assertThat(failures.get(0)).isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("Aday aynı saatlerde kabul edilmiş başka bir vardiyada");
            assertThat(applications.findAllByCandidateIdAndStatus(ids[2], ApplicationStatus.ACCEPTED)).hasSize(1);
        } finally {
            executor.shutdownNow();
        }
    }
}
