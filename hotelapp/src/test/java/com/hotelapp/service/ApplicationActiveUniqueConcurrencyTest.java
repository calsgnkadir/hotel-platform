package com.hotelapp.service;

import com.hotelapp.dto.ApplicationRequest;
import com.hotelapp.dto.ApplicationResponse;
import com.hotelapp.entity.*;
import com.hotelapp.enums.*;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.ApplicationRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.mockito.AdditionalAnswers;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * V28 — ayni aday + ayni ilan icin tek AKTIF basvuru, veritabani kisitiyla
 * (uk_applications_candidate_active_listing). Varsayilan H2 (create-drop, entity'deki
 * generated kolon tanimi); MySQL env verilirse Flyway V28 + validate ile gercek MySQL'de kosar.
 */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import(ApplicationService.class)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class ApplicationActiveUniqueConcurrencyTest {
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

    @BeforeEach
    void stubs() {
        when(messageService.openConversationForApplication(any(), any()))
                .thenReturn(Conversation.builder().id(1L).build());
        when(applicationMapper.toResponse(any())).thenReturn(ApplicationResponse.builder().build());
    }

    /** {candidateId, listingId} */
    private Long[] seed(String prefix) {
        String tag = prefix + "-" + System.nanoTime();
        return new TransactionTemplate(transactionManager).execute(s -> {
            User candidate = User.builder().email("cand-" + tag + "@test.com").password("x")
                    .fullName("Aday").role(Role.CANDIDATE).build();
            em.persist(candidate);
            User owner = User.builder().email("owner-" + tag + "@test.com").password("x")
                    .fullName("Owner").role(Role.BUSINESS_OWNER).build();
            em.persist(owner);
            Business business = Business.builder().owner(owner).name("Otel").city("Istanbul")
                    .district("Sisli").type(BusinessType.RESTAURANT).build();
            em.persist(business);
            JobListing listing = JobListing.builder().business(business).title("Garson")
                    .description("test").position(Position.WAITER).jobType(JobType.PERMANENT)
                    .status(ListingStatus.ACTIVE).build();
            em.persist(listing);
            em.flush();
            return new Long[] {candidate.getId(), listing.getId()};
        });
    }

    private Application insert(Long candidateId, Long listingId, ApplicationStatus status) {
        return new TransactionTemplate(transactionManager).execute(s -> applications.saveAndFlush(
                Application.builder().candidate(em.getReference(User.class, candidateId))
                        .jobListing(em.getReference(JobListing.class, listingId))
                        .status(status).deadline(LocalDateTime.now().plusDays(7)).build()));
    }

    private long activeCount(Long candidateId, Long listingId) {
        return new TransactionTemplate(transactionManager).execute(s -> em.createQuery(
                "SELECT COUNT(a) FROM Application a WHERE a.candidate.id = :c AND a.jobListing.id = :l"
                        + " AND a.status IN :st", Long.class)
                .setParameter("c", candidateId).setParameter("l", listingId)
                .setParameter("st", ApplicationService.ACTIVE_FOR_DUPLICATE).getSingleResult());
    }

    @Test
    void db_rejects_second_active_but_allows_reapply_after_closed_ones() {
        Long[] ids = seed("uk");
        // Sonuclanmis basvurular (NULL anahtar) birbirini ve yeni aktif basvuruyu engellemez.
        insert(ids[0], ids[1], ApplicationStatus.REJECTED);
        insert(ids[0], ids[1], ApplicationStatus.WITHDRAWN);
        insert(ids[0], ids[1], ApplicationStatus.EXPIRED);
        insert(ids[0], ids[1], ApplicationStatus.EXPIRED);
        Application active = insert(ids[0], ids[1], ApplicationStatus.PENDING);

        for (ApplicationStatus st : ApplicationService.ACTIVE_FOR_DUPLICATE) {
            assertThatThrownBy(() -> insert(ids[0], ids[1], st))
                    .as("ikinci aktif basvuru (%s)", st)
                    .isInstanceOf(DataIntegrityViolationException.class)
                    .satisfies(e -> assertThat(ApplicationService.isActiveDuplicateViolation(e)).isTrue());
        }
        assertThat(activeCount(ids[0], ids[1])).isEqualTo(1);

        // Aktif basvuru sonuclaninca (WITHDRAWN) yeniden basvuru serbest.
        new TransactionTemplate(transactionManager).executeWithoutResult(s -> {
            Application a = applications.findById(active.getId()).orElseThrow();
            a.setStatus(ApplicationStatus.WITHDRAWN);
        });
        insert(ids[0], ids[1], ApplicationStatus.PENDING);
        assertThat(activeCount(ids[0], ids[1])).isEqualTo(1);
    }

    @Test
    void service_check_bypassed_db_constraint_returns_dup_active() {
        Long[] ids = seed("seq");
        withServiceCheckBypassed(() -> {
            service.createApplication(ids[0], request(ids[1]));
            assertThatThrownBy(() -> service.createApplication(ids[0], request(ids[1])))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessage("error.application.dupActive");
        });
        assertThat(activeCount(ids[0], ids[1])).isEqualTo(1);
    }

    /** Servis kontrolu atlanir: iki istek de INSERT'e ulasir, yalniz DB kisiti ayirir. */
    @RepeatedTest(3)
    void concurrent_applies_db_level_race_exactly_one_wins() throws Exception {
        Long[] ids = seed("race-db");
        withServiceCheckBypassed(() -> assertExactlyOneWins(ids));
    }

    /** Uctan uca: gercek servis kontrolu + DB kisiti birlikte. */
    @RepeatedTest(3)
    void concurrent_applies_end_to_end_exactly_one_wins() throws Exception {
        Long[] ids = seed("race-e2e");
        assertExactlyOneWins(ids);
    }

    private void assertExactlyOneWins(Long[] ids) {
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch ready = new CountDownLatch(2), start = new CountDownLatch(1);
            List<Future<Throwable>> results = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                results.add(executor.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timed out");
                    try {
                        service.createApplication(ids[0], request(ids[1]));
                        return null;
                    } catch (Throwable t) {
                        return t;
                    }
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<Throwable> failures = new ArrayList<>();
            for (Future<Throwable> f : results) {
                Throwable t = f.get(30, TimeUnit.SECONDS);
                if (t != null) failures.add(t);
            }
            assertThat(failures).as("tam olarak bir basvuru reddedilmeli").hasSize(1);
            assertThat(failures.get(0)).isInstanceOf(BusinessRuleException.class)
                    .hasMessage("error.application.dupActive");
            assertThat(activeCount(ids[0], ids[1])).isEqualTo(1);
        } catch (Exception e) {
            throw new AssertionError(e);
        } finally {
            executor.shutdownNow();
        }
    }

    private static ApplicationRequest request(Long listingId) {
        ApplicationRequest r = new ApplicationRequest();
        r.setJobListingId(listingId);
        return r;
    }

    /** Yaris penceresini garanti etmek icin servis on kontrolunu bos dondurur (diger cagrilar gercek repo). */
    private void withServiceCheckBypassed(Runnable body) {
        Object target = AopTestUtils.getUltimateTargetObject(service);
        ApplicationRepository bypass = Mockito.mock(ApplicationRepository.class,
                AdditionalAnswers.delegatesTo(applications));
        Mockito.doReturn(Optional.empty()).when(bypass)
                .findFirstByCandidateIdAndJobListingIdAndStatusIn(anyLong(), anyLong(), any(Collection.class));
        ReflectionTestUtils.setField(target, "applicationRepository", bypass);
        try {
            body.run();
        } finally {
            ReflectionTestUtils.setField(target, "applicationRepository", applications);
        }
    }
}
