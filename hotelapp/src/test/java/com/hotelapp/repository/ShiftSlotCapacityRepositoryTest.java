package com.hotelapp.repository;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.GlobalExceptionHandler;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.Mockito.mock;

/**
 * K1 — slot sayacı koşullu atomik UPDATE ile değişir (kapasiteyi aşmaz, 0'ın
 * altına inmez) ve V22 iyimser kilidi başvuru durum yarışını 409'a çevirir.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class ShiftSlotCapacityRepositoryTest {

    @Autowired private ShiftSlotRepository shiftSlotRepository;
    @Autowired private ApplicationRepository applicationRepository;
    @Autowired private EntityManager em;

    private JobListing listing() {
        User owner = User.builder().email("owner@test.com").password("x").fullName("Sahip")
                .role(Role.BUSINESS_OWNER).isStudent(false).strikesRemaining(3).enabled(true).build();
        em.persist(owner);
        Business b = Business.builder().name("Otel").type(BusinessType.RESTAURANT)
                .city("Istanbul").district("Kadikoy").owner(owner).build();
        em.persist(b);
        JobListing l = JobListing.builder().business(b).position(Position.WAITER).jobType(JobType.PERMANENT)
                .title("Gece").description("demo").status(ListingStatus.ACTIVE).build();
        em.persist(l);
        return l;
    }

    private ShiftSlot slot(JobListing l, int needed) {
        ShiftSlot s = ShiftSlot.builder().jobListing(l).date(LocalDate.now().plusDays(2))
                .startTime(LocalTime.of(22, 0)).endTime(LocalTime.of(6, 0))
                .slotsNeeded(needed).slotsFilled(0).build();
        em.persist(s);
        em.flush();
        return s;
    }

    private int filled(Long id) {
        em.clear();
        return shiftSlotRepository.findById(id).orElseThrow().getSlotsFilled();
    }

    @Test
    void increment_stopsAtCapacity_decrement_stopsAtZero() {
        ShiftSlot s = slot(listing(), 2);

        assertThat(shiftSlotRepository.incrementFilledIfAvailable(s.getId())).isEqualTo(1);
        assertThat(shiftSlotRepository.incrementFilledIfAvailable(s.getId())).isEqualTo(1);
        // Son koltuk alındı: üçüncü kabul 0 satır günceller → servis 422 "Bu vardiya doldu".
        assertThat(shiftSlotRepository.incrementFilledIfAvailable(s.getId())).isZero();
        assertThat(filled(s.getId())).isEqualTo(2);

        assertThat(shiftSlotRepository.decrementFilled(s.getId())).isEqualTo(1);
        assertThat(shiftSlotRepository.decrementFilled(s.getId())).isEqualTo(1);
        assertThat(shiftSlotRepository.decrementFilled(s.getId())).isZero();
        assertThat(filled(s.getId())).isZero();
    }

    @Test
    void slotEdit_doesNotWriteBackStaleCounter() {
        ShiftSlot s = slot(listing(), 3);
        em.clear();
        ShiftSlot loaded = shiftSlotRepository.findById(s.getId()).orElseThrow();   // slotsFilled=0 (bayat olacak)

        shiftSlotRepository.incrementFilledIfAvailable(s.getId());                // başka bir kabul
        loaded.setSlotsNeeded(4);                                                 // işletme düzenlemesi
        em.flush();

        // DynamicUpdate: yalnız slots_needed yazılır, sayaç 0'a ezilmez.
        assertThat(filled(s.getId())).isEqualTo(1);
    }

    @Test
    void concurrentStatusChange_onApplication_isOptimisticLockConflict_409() {
        JobListing l = listing();
        User cand = User.builder().email("aday@test.com").password("x").fullName("Aday")
                .role(Role.CANDIDATE).isStudent(false).strikesRemaining(3).enabled(true).build();
        em.persist(cand);
        Application app = Application.builder().candidate(cand).jobListing(l)
                .status(ApplicationStatus.REVIEWING).build();
        em.persist(app);
        em.flush();
        em.clear();

        Application stale = applicationRepository.findById(app.getId()).orElseThrow();
        em.detach(stale);
        Application fresh = applicationRepository.findById(app.getId()).orElseThrow();
        assertThat(fresh.getVersion()).isZero();
        fresh.setStatus(ApplicationStatus.ACCEPTED);
        applicationRepository.saveAndFlush(fresh);
        em.clear();

        stale.setStatus(ApplicationStatus.REJECTED);
        ObjectOptimisticLockingFailureException ex = catchThrowableOfType(
                () -> applicationRepository.saveAndFlush(stale), ObjectOptimisticLockingFailureException.class);

        assertThat(ex).isNotNull();
        var resp = new GlobalExceptionHandler(mock(com.hotelapp.config.Messages.class)).handleOptimisticLock(ex);
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(resp.getBody()).containsEntry("message",
                "Başvuru bu sırada güncellendi, sayfayı yenileyip tekrar dene.");
    }
}
