package com.hotelapp.service;

import com.hotelapp.entity.*;
import com.hotelapp.enums.*;
import jakarta.persistence.EntityManager;
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
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;

/**
 * Kayıp güncelleme: aday profilini kilitsiz okuyup kaydederken araya "gelmedi" işareti
 * (ceza düşer, aday satırı kilitli) girer. User @Version'sız; @DynamicUpdate olmadan
 * profil kaydı tüm kolonları eski değerlerle yazar ve cezayı geri alır. Sıra
 * deterministik: profil transaction'ı aday satırını okur, gelmedi işareti başka
 * thread'de commit olur, sonra profil kaydı commit olur.
 */
@DataJpaTest(showSql = false)
@ActiveProfiles("test")
@Import({ApplicationService.class, CandidateProfileService.class})
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class UserLostUpdateTest {
    @Autowired ApplicationService applicationService;
    @Autowired CandidateProfileService profileService;
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
    @MockitoBean FileStorageService fileStorageService;
    @MockitoBean ProfileViewService profileViewService;

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final LocalDate DAY = LocalDate.of(2026, 10, 3);

    @Test
    void profile_update_racing_no_show_keeps_strike() throws Exception {
        ReflectionTestUtils.setField(applicationService, "clock",
                Clock.fixed(DAY.atTime(9, 0).atZone(TR).toInstant(), TR));
        String tag = Long.toString(System.nanoTime());
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        Long[] ids = tx.execute(status -> {
            User candidate = User.builder().email("lost-upd-" + tag + "@test.com").password("x")
                    .fullName("Aday").role(Role.CANDIDATE).strikesRemaining(3).build();
            em.persist(candidate);
            User owner = User.builder().email("lost-upd-owner-" + tag + "@test.com").password("x")
                    .fullName("Owner").role(Role.BUSINESS_OWNER).build();
            em.persist(owner);
            Business business = Business.builder().owner(owner).name("Otel").city("Istanbul")
                    .district("Sisli").type(BusinessType.RESTAURANT).build();
            em.persist(business);
            JobListing listing = JobListing.builder().business(business).title("Vardiya")
                    .description("test").position(Position.WAITER).jobType(JobType.PERMANENT)
                    .status(ListingStatus.ACTIVE).build();
            em.persist(listing);
            ShiftSlot slot = ShiftSlot.builder().jobListing(listing).date(DAY)
                    .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0))
                    .slotsNeeded(1).slotsFilled(1).build();
            em.persist(slot);
            Application app = Application.builder().candidate(candidate).jobListing(listing)
                    .status(ApplicationStatus.ACCEPTED).deadline(DAY.atTime(23, 0))
                    .requestedSlots(new HashSet<>(Set.of(slot))).build();
            em.persist(app);
            em.flush();
            return new Long[] { candidate.getId(), owner.getId(), app.getId(), slot.getId() };
        });
        Long candidateId = ids[0], ownerId = ids[1], appId = ids[2], slotId = ids[3];

        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            tx.executeWithoutResult(status -> {
                // Profil isteği aday satırını kilitsiz okudu (strikes=3) ...
                User stale = em.find(User.class, candidateId);
                assertThat(stale.getStrikesRemaining()).isEqualTo(3);
                // ... bu arada işletme "gelmedi" işaretledi ve commit etti (strikes=2)
                Future<?> noShow = executor.submit(() -> applicationService.markNoShow(appId, ownerId, slotId));
                try {
                    noShow.get(30, TimeUnit.SECONDS);
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
                // ... profil kaydı aynı (bayat) nesneyle devam eder ve commit olur
                CandidateProfileService.ProfileUpdateRequest req = new CandidateProfileService.ProfileUpdateRequest();
                req.setFullName("Aday Yeni Ad");
                profileService.updateMyProfile(candidateId, req);
            });

            User fresh = tx.execute(status -> em.find(User.class, candidateId));
            assertThat(fresh.getFullName()).isEqualTo("Aday Yeni Ad");
            assertThat(fresh.getStrikesRemaining())
                    .as("profil kaydı eşzamanlı gelmedi cezasını ezmemeli").isEqualTo(2);
        } finally {
            executor.shutdownNow();
        }
    }
}
