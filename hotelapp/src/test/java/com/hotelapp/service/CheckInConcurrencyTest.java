package com.hotelapp.service;

import com.hotelapp.entity.*;
import com.hotelapp.enums.*;
import com.hotelapp.repository.WorkSessionRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.*;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;

@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import(CheckInService.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class CheckInConcurrencyTest {
    @Autowired CheckInService service;
    @Autowired EntityManager em;
    @Autowired WorkSessionRepository sessions;
    @Autowired PlatformTransactionManager transactionManager;
    @MockBean RosterService rosterService;
    @MockBean FileStorageService fileStorageService;

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void concurrent_entry_creates_one_row_and_database_rejects_duplicates(boolean manual) throws Exception {
        LocalDate day = LocalDate.of(2026, 10, 3);
        ZoneId zone = ZoneId.of("Europe/Istanbul");
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(day.atTime(8, 0).atZone(zone).toInstant(), zone));
        ReflectionTestUtils.setField(service, "secret", "test-secret-at-least-32-characters-long");
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        Long[] ids = tx.execute(status -> {
            User owner = User.builder().email("race-owner-" + manual + "@test.com").password("x").fullName("Owner")
                    .role(Role.BUSINESS_OWNER).build();
            User candidate = User.builder().email("race-worker-" + manual + "@test.com").password("x").fullName("Worker")
                    .role(Role.CANDIDATE).build();
            em.persist(owner);
            em.persist(candidate);
            Business business = Business.builder().owner(owner).name("Race hotel").city("Istanbul")
                    .district("Sisli").type(BusinessType.RESTAURANT).build();
            em.persist(business);
            JobListing listing = JobListing.builder().business(business).title("Race shift").description("test")
                    .position(Position.WAITER).jobType(JobType.PERMANENT).status(ListingStatus.ACTIVE).build();
            em.persist(listing);
            ShiftSlot slot = ShiftSlot.builder().jobListing(listing).date(day)
                    .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build();
            em.persist(slot);
            Application app = Application.builder().candidate(candidate).jobListing(listing)
                    .status(ApplicationStatus.ACCEPTED).deadline(day.atTime(23, 0))
                    .requestedSlots(new HashSet<>(Set.of(slot))).build();
            em.persist(app);
            em.flush();
            return new Long[] {app.getId(), slot.getId(), owner.getId()};
        });
        String token = service.tokenFor(ids[0], ids[1], day);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
            Callable<CheckInService.ScanResult> scan = () -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                return service.scan(token, ids[2]);
            };
            Future<CheckInService.ScanResult> a = executor.submit(scan);
            Future<CheckInService.ScanResult> b = executor.submit(() -> {
                if (!manual) return scan.call();
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                service.manualCheckIn(ids[0], ids[2], ids[1]);
                return null;
            });
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            var first = a.get(30, TimeUnit.SECONDS);
            var second = b.get(30, TimeUnit.SECONDS);
            if (!manual) assertThat(List.of(first.isAlreadyUsed(), second.isAlreadyUsed()))
                    .containsExactlyInAnyOrder(false, true);
            service.manualCheckIn(ids[0], ids[2], ids[1]);
            assertThat(sessions.findByApplicationIdOrderByClockInAtDesc(ids[0])).hasSize(1);
            assertThatThrownBy(() -> tx.execute(status -> {
                sessions.saveAndFlush(WorkSession.builder().application(em.getReference(Application.class, ids[0]))
                        .shiftSlotId(ids[1]).clockInAt(day.atTime(9, 0)).build());
                return null;
            })).isInstanceOf(DataIntegrityViolationException.class);
        } finally {
            executor.shutdownNow();
        }
    }
}
