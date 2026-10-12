package com.hotelapp.repository;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.ApplicationNoShowSlot;
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
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Karar 1 — tamamlanan iş ve gelmedi sayımı vardiya bazında (gerçek JPQL, H2):
 * tek vardiyalık gelmedi çok vardiyalı başvuruyu düşürmez; tüm vardiyaları gelmedi
 * olan başvuru ve V25 öncesi eski kayıt (noShow=true, satır yok) düşer. Gelmedi
 * sayısı = işaretli vardiya satırı + eski kayıt başına 1.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class ApplicationCompletedJobsCountTest {

    @Autowired private ApplicationRepository applicationRepository;
    @Autowired private EntityManager em;

    private User owner;
    private JobListing listing;
    private User candidate;

    @BeforeEach
    void setUp() {
        owner = user("owner@test.com", Role.BUSINESS_OWNER);
        Business b = Business.builder().name("Otel").type(BusinessType.HOTEL)
                .city("Istanbul").district("Sisli").owner(owner).build();
        em.persist(b);
        listing = JobListing.builder().business(b).position(Position.WAITER).jobType(JobType.PERMANENT)
                .title("Banket").description("demo").status(ListingStatus.ACTIVE).build();
        em.persist(listing);
        candidate = user("aday@test.com", Role.CANDIDATE);
    }

    private User user(String email, Role role) {
        User u = User.builder().email(email).password("x").fullName("Kisi " + email)
                .role(role).isStudent(false).strikesRemaining(3).enabled(true).build();
        em.persist(u);
        return u;
    }

    private ShiftSlot slot(int daysAgo) {
        ShiftSlot s = ShiftSlot.builder().jobListing(listing).date(LocalDate.now().minusDays(daysAgo))
                .startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(16, 0))
                .slotsNeeded(3).slotsFilled(1).build();
        em.persist(s);
        return s;
    }

    private Application accepted(User cand, boolean noShow, ShiftSlot... slots) {
        Application a = Application.builder().candidate(cand).jobListing(listing)
                .status(ApplicationStatus.ACCEPTED).noShow(noShow)
                .reviewedAt(LocalDateTime.now().minusDays(10))
                .requestedSlots(new HashSet<>(Set.of(slots))).build();
        em.persist(a);
        return a;
    }

    private void markNoShow(Application a, ShiftSlot s) {
        em.persist(ApplicationNoShowSlot.builder().application(a).shiftSlot(s).build());
    }

    private void flush() {
        em.flush();
        em.clear();
    }

    @Test
    void single_no_show_in_multi_shift_application_keeps_job_completed() {
        ShiftSlot d1 = slot(3), d2 = slot(2), d3 = slot(1);
        Application a = accepted(candidate, true, d1, d2, d3);
        markNoShow(a, d2);
        flush();

        assertThat(applicationRepository.countCompletedJobsForCandidate(candidate.getId())).isEqualTo(1);
        assertThat(applicationRepository.countNoShowsForCandidate(candidate.getId())).isEqualTo(1);
        assertThat(applicationRepository.countCompletedByBusinessOwner(owner.getId())).isEqualTo(1);
    }

    @Test
    void all_shifts_no_show_drops_job_and_counts_each_shift() {
        ShiftSlot d1 = slot(3), d2 = slot(2);
        Application a = accepted(candidate, true, d1, d2);
        markNoShow(a, d1);
        markNoShow(a, d2);
        flush();

        assertThat(applicationRepository.countCompletedJobsForCandidate(candidate.getId())).isZero();
        assertThat(applicationRepository.countNoShowsForCandidate(candidate.getId())).isEqualTo(2);
        assertThat(applicationRepository.countCompletedByBusinessOwner(owner.getId())).isZero();
    }

    @Test
    void legacy_no_show_without_slot_rows_still_drops_and_counts_once() {
        accepted(candidate, true, slot(3), slot(2));   // V25 öncesi: bayrak var, satır yok
        flush();

        assertThat(applicationRepository.countCompletedJobsForCandidate(candidate.getId())).isZero();
        assertThat(applicationRepository.countNoShowsForCandidate(candidate.getId())).isEqualTo(1);
        assertThat(applicationRepository.countCompletedByBusinessOwner(owner.getId())).isZero();
    }

    @Test
    void mixed_history_counts_per_rule_and_ignores_other_candidates() {
        ShiftSlot a1 = slot(5), a2 = slot(4), b1 = slot(3);
        Application partial = accepted(candidate, true, a1, a2);   // 1 gelmedi, 1 çalışıldı → tamamlandı
        markNoShow(partial, a2);
        Application fullNoShow = accepted(candidate, true, b1);    // tek vardiya gelmedi → düşer
        markNoShow(fullNoShow, b1);
        accepted(candidate, true, slot(6));                       // eski kayıt → düşer, 1 gelmedi
        accepted(candidate, false, slot(7));                      // temiz → tamamlandı
        accepted(candidate, false);                               // slotsuz eski akış → tamamlandı
        Application pending = Application.builder().candidate(candidate).jobListing(listing)
                .status(ApplicationStatus.PENDING).build();
        em.persist(pending);                                      // kabul değil → sayılmaz
        User other = user("baska@test.com", Role.CANDIDATE);
        Application otherApp = accepted(other, true, slot(1));
        markNoShow(otherApp, otherApp.getRequestedSlots().iterator().next());
        flush();

        assertThat(applicationRepository.countCompletedJobsForCandidate(candidate.getId())).isEqualTo(3);
        assertThat(applicationRepository.countNoShowsForCandidate(candidate.getId())).isEqualTo(3);
        // İşletme geneli: adayın 3 tamamlanan işi + diğer adayın düşen başvurusu (0)
        assertThat(applicationRepository.countCompletedByBusinessOwner(owner.getId())).isEqualTo(3);
    }
}
