package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import com.hotelapp.event.ListingClosedEvent;
import com.hotelapp.repository.JobListingRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Real detached JPA entities, no request OSIV or outer test transaction to hide lazy loading. */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({RosterEmailScheduler.class, RosterEmailSchedulerTest.AsyncTestConfiguration.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class RosterEmailSchedulerTest {
    @Autowired RosterEmailScheduler scheduler;
    @Autowired JobListingRepository listings;
    @Autowired EntityManager em;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired ApplicationEventPublisher events;
    @MockitoBean RosterService rosters;
    @MockitoBean EmailService email;
    @MockitoBean EmailTemplates templates;
    @MockitoBean NotificationService notifications;

    private static final byte[] XLSX = {1, 2, 3};

    @Test
    void dailyRosterLoadsDetachedOwnerAndSendsOutsideDatabaseTransaction() {
        LocalDate day = LocalDate.of(2031, 1, 3);
        Fixture fixture = fixture(day);
        JobListing detached = listings.findById(fixture.listingId()).orElseThrow();
        assertThat(Hibernate.isInitialized(detached.getBusiness())).isFalse();
        when(rosters.xlsxForDateOrNull(fixture.listingId(), day)).thenReturn(XLSX);
        when(templates.rosterReady(anyString(), anyString(), anyString(), anyInt(), anyString()))
                .thenReturn("<p>Roster</p>");
        AtomicBoolean networkInsideTransaction = new AtomicBoolean(true);
        doAnswer(call -> {
            networkInsideTransaction.set(TransactionSynchronizationManager.isActualTransactionActive());
            return null;
        }).when(email).sendWithAttachment(anyString(), anyString(), anyString(), anyString(), any());

        assertThat(scheduler.sendRostersFor(day)).isEqualTo(1);

        verify(email).sendWithAttachment(eq(fixture.email()), contains("Vardiya"), eq("<p>Roster</p>"),
                eq("kadrom-ekip-" + fixture.listingId() + "-" + day + ".xlsx"), same(XLSX));
        verify(notifications).notify(eq(fixture.ownerId()), eq(NotificationType.GENERIC),
                eq("Ekip listesi hazır"), contains("listesi e-postana gönderildi"), eq("mylistings"));
        assertThat(networkInsideTransaction).isFalse();
    }

    @Test
    void closingEventSendsAfterCommitOnAsyncThreadWithDetachedOwner() {
        Fixture fixture = fixture(LocalDate.of(2031, 1, 4));
        when(rosters.xlsxAllOrNull(fixture.listingId())).thenReturn(XLSX);
        when(templates.rosterReady(anyString(), anyString(), anyString(), anyInt(), anyString()))
                .thenReturn("<p>Closing roster</p>");
        AtomicBoolean networkInsideTransaction = new AtomicBoolean(true);
        AtomicReference<String> senderThread = new AtomicReference<>();
        doAnswer(call -> {
            networkInsideTransaction.set(TransactionSynchronizationManager.isActualTransactionActive());
            senderThread.set(Thread.currentThread().getName());
            return null;
        }).when(email).sendWithAttachment(anyString(), anyString(), anyString(), anyString(), any());

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            listings.findById(fixture.listingId()).orElseThrow().setStatus(ListingStatus.CLOSED);
            events.publishEvent(new ListingClosedEvent(fixture.listingId()));
            verifyNoInteractions(email);
        });

        verify(email, timeout(5000)).sendWithAttachment(eq(fixture.email()),
                contains("ilan kapandı"), eq("<p>Closing roster</p>"),
                eq("kadrom-ekip-" + fixture.listingId() + "-tum.xlsx"), same(XLSX));
        verify(notifications, timeout(5000)).notify(eq(fixture.ownerId()), eq(NotificationType.GENERIC),
                eq("Ekip listesi hazır"), contains("kapandı"), eq("mylistings"));
        assertThat(senderThread.get()).startsWith("roster-regression-");
        assertThat(networkInsideTransaction).isFalse();
    }

    @Test
    void rolledBackClosureDoesNotSendRoster() {
        Fixture fixture = fixture(LocalDate.of(2031, 1, 5));
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            events.publishEvent(new ListingClosedEvent(fixture.listingId()));
            status.setRollbackOnly();
        });
        verify(email, after(300).never()).sendWithAttachment(anyString(), anyString(), anyString(), anyString(), any());
        verifyNoInteractions(rosters, notifications);
    }

    private Fixture fixture(LocalDate day) {
        return new TransactionTemplate(transactionManager).execute(status -> {
            String address = "roster-" + System.nanoTime() + "@example.test";
            User owner = User.builder().email(address).password("test-only")
                    .fullName("Ekip Test İşletmesi").role(Role.BUSINESS_OWNER).build();
            em.persist(owner);
            Business business = Business.builder().name("Test Kafe").type(BusinessType.CAFE).owner(owner).build();
            em.persist(business);
            JobListing listing = JobListing.builder().business(business).title("Vardiya")
                    .description("Test").position(Position.WAITER).jobType(JobType.DAILY)
                    .status(ListingStatus.ACTIVE).build();
            em.persist(listing);
            em.persist(ShiftSlot.builder().jobListing(listing).date(day)
                    .startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(17, 0)).build());
            em.flush();
            return new Fixture(listing.getId(), owner.getId(), address);
        });
    }

    private record Fixture(Long listingId, Long ownerId, String email) {}

    @TestConfiguration(proxyBeanMethods = false)
    @EnableAsync
    static class AsyncTestConfiguration {
        @Bean(name = "taskExecutor")
        ThreadPoolTaskExecutor taskExecutor() {
            ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
            executor.setCorePoolSize(1);
            executor.setMaxPoolSize(1);
            executor.setThreadNamePrefix("roster-regression-");
            executor.setWaitForTasksToCompleteOnShutdown(true);
            return executor;
        }
    }
}
