package com.hotelapp.service;

import com.hotelapp.entity.*;
import com.hotelapp.enums.*;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.WorkSessionRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;

/** Real database, committed transactions and locks; no external provider needed. */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import(CheckInService.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class ExitPassJpaTest {
    @Autowired CheckInService service;
    @Autowired EntityManager em;
    @Autowired WorkSessionRepository sessions;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean RosterService roster;
    @MockitoBean FileStorageService files;
    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDateTime NOW = LocalDateTime.of(2031, 1, 7, 17, 0);
    private TransactionTemplate tx;

    @BeforeEach void setup() {
        tx = new TransactionTemplate(transactionManager);
        ReflectionTestUtils.setField(service, "secret", "test-secret-at-least-32-characters-long");
        ReflectionTestUtils.setField(service, "baseUrl", "https://example.test");
        at(NOW);
    }

    private void at(LocalDateTime time) {
        ReflectionTestUtils.setField(service, "clock", Clock.fixed(time.atZone(TR).toInstant(), TR));
    }

    private record Fixture(Long app, Long session, Long candidate, Long owner, Long otherOwner, Long slot) {}

    private Fixture fixture() {
        return tx.execute(status -> {
            String unique = UUID.randomUUID().toString();
            User owner = User.builder().email("owner-" + unique + "@test.invalid").fullName("Owner").role(Role.BUSINESS_OWNER).build();
            User other = User.builder().email("other-" + unique + "@test.invalid").fullName("Other").role(Role.BUSINESS_OWNER).build();
            User candidate = User.builder().email("candidate-" + unique + "@test.invalid").fullName("Candidate").role(Role.CANDIDATE).build();
            em.persist(owner); em.persist(other); em.persist(candidate);
            Business biz = Business.builder().name("Test cafe").type(BusinessType.CAFE).owner(owner).build(); em.persist(biz);
            JobListing listing = JobListing.builder().business(biz).title("Test").description("Test")
                    .position(Position.WAITER).jobType(JobType.DAILY).status(ListingStatus.ACTIVE).build(); em.persist(listing);
            ShiftSlot slot = ShiftSlot.builder().jobListing(listing).date(NOW.toLocalDate())
                    .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0)).build(); em.persist(slot);
            Application app = Application.builder().candidate(candidate).jobListing(listing).status(ApplicationStatus.ACCEPTED)
                    .requestedSlots(new HashSet<>(Set.of(slot))).build(); em.persist(app);
            WorkSession session = WorkSession.builder().application(app).shiftSlotId(slot.getId()).clockInAt(NOW.minusHours(8)).build();
            em.persist(session); em.flush();
            return new Fixture(app.getId(), session.getId(), candidate.getId(), owner.getId(), other.getId(), slot.getId());
        });
    }

    @Test void expiredTamperedForeignAndEntryTokensNeverCloseWork() {
        Fixture f = fixture();
        var passes = service.myExitPasses(f.candidate());
        assertThat(passes).hasSize(1); // shift already ended, exit remains available
        String url = passes.get(0).getPassUrl();
        assertThat(url).startsWith("https://example.test/cikis/");
        String token = url.substring(url.lastIndexOf('/') + 1);
        assertThat(service.myExitPasses(f.otherOwner())).isEmpty();
        assertThatThrownBy(() -> service.scanExit(token, f.otherOwner())).isInstanceOf(UnauthorizedException.class);
        assertThatThrownBy(() -> service.scanExit(token + "x", f.owner())).isInstanceOf(BusinessRuleException.class);
        Fixture other = fixture();
        assertThatThrownBy(() -> service.scanExit(service.exitTokenFor(f.app(), other.session()), f.owner()))
                .isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> service.scanExit(service.tokenFor(f.app(), f.slot(), NOW.toLocalDate()), f.owner()))
                .isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> service.scan(token, f.owner())).isInstanceOf(BusinessRuleException.class);
        at(NOW.plusMinutes(11));
        assertThatThrownBy(() -> service.scanExit(token, f.owner())).isInstanceOf(BusinessRuleException.class);
        assertThat(sessions.findById(f.session()).orElseThrow().getClockOutAt()).isNull();
        assertThat(service.scanExit(service.exitTokenFor(f.app(), f.session()), f.owner()).isAlreadyUsed()).isFalse();
    }

    @Test void simultaneousScansHaveOneExitAndPreserveFirstTimestamp() throws Exception {
        Fixture f = fixture();
        String token = service.exitTokenFor(f.app(), f.session());
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2), go = new CountDownLatch(1);
        Callable<CheckInService.ExitScanResult> call = () -> {
            ready.countDown();
            if (!go.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Timed out");
            return service.scanExit(token, f.owner());
        };
        try {
            Future<CheckInService.ExitScanResult> a = pool.submit(call), b = pool.submit(call);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            go.countDown();
            var first = a.get(30, TimeUnit.SECONDS); var second = b.get(30, TimeUnit.SECONDS);
            assertThat(List.of(first.isAlreadyUsed(), second.isAlreadyUsed())).containsExactlyInAnyOrder(false, true);
            assertThat(first.getClockOutAt()).isEqualTo(NOW).isEqualTo(second.getClockOutAt());
            assertThat(sessions.findById(f.session()).orElseThrow().getClockOutAt()).isEqualTo(NOW);
            assertThat(service.myExitPasses(f.candidate())).isEmpty();
        } finally { pool.shutdownNow(); }
    }
}
