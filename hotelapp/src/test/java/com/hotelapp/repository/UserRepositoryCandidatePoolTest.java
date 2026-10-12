package com.hotelapp.repository;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.BusinessBlock;
import com.hotelapp.entity.CandidateBlock;
import com.hotelapp.entity.User;
import com.hotelapp.entity.UserAvailabilityBlock;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Toplu aday bildirim havuzlari (acil ilan, eslesen ilan) — engel ve hesap durumu
 * filtreleri gercek JPQL ile (H2) dogrulanir:
 * isletmenin engelledigi aday, isletmeyi engelleyen aday, devre disi (silme talebi)
 * ve banli aday havuza girmez; baska isletmenin engeli bu isletmeyi etkilemez.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class UserRepositoryCandidatePoolTest {

    @Autowired private UserRepository userRepository;
    @Autowired private EntityManager em;

    private Business biz;
    private Business otherBiz;
    private User ok, blockedByBiz, blockedBiz, disabled, banned, blockedByOther;

    private User candidate(String email) {
        User u = User.builder()
                .email(email).password("x").fullName("Aday " + email)
                .role(Role.CANDIDATE).isStudent(false).strikesRemaining(3).enabled(true)
                .availableUntil(LocalDateTime.now().plusHours(5))
                .preferredDistricts(new java.util.HashSet<>(Set.of("Sisli")))
                .preferredPositions(new java.util.HashSet<>(Set.of(Position.WAITER)))
                .build();
        em.persist(u);
        em.persist(UserAvailabilityBlock.builder().user(u)
                .dayOfWeek(DayOfWeek.MONDAY).startTime(LocalTime.of(8, 0)).endTime(LocalTime.of(18, 0)).build());
        return u;
    }

    private Business business(String email) {
        User owner = User.builder().email(email).password("x").fullName("Sahip")
                .role(Role.BUSINESS_OWNER).isStudent(false).strikesRemaining(3).enabled(true).build();
        em.persist(owner);
        Business b = Business.builder().name("Biz " + email).type(BusinessType.HOTEL)
                .city("Istanbul").district("Sisli").owner(owner).build();
        em.persist(b);
        return b;
    }

    @BeforeEach
    void setUp() {
        biz = business("o1@test.com");
        otherBiz = business("o2@test.com");
        ok = candidate("ok@test.com");
        blockedByBiz = candidate("blocked-by-biz@test.com");
        blockedBiz = candidate("blocked-biz@test.com");
        disabled = candidate("disabled@test.com");
        disabled.setEnabled(false);
        banned = candidate("banned@test.com");
        banned.setBannedUntil(LocalDateTime.now().plusDays(2));
        blockedByOther = candidate("blocked-by-other@test.com");

        em.persist(CandidateBlock.builder().business(biz).candidate(blockedByBiz).build());
        em.persist(BusinessBlock.builder().business(biz).user(blockedBiz).build());
        em.persist(CandidateBlock.builder().business(otherBiz).candidate(blockedByOther).build());
        em.flush();
        em.clear();
    }

    private static List<String> emails(List<User> users) {
        return users.stream().map(User::getEmail).sorted().toList();
    }

    private static final List<String> EXPECTED =
            List.of("blocked-by-other@test.com", "ok@test.com");

    @Test
    void availableNowPool_excludesBlockedDisabledAndBanned() {
        var pool = userRepository.findAvailableNowCandidates(LocalDateTime.now(), Position.WAITER, biz.getId());
        assertThat(emails(pool)).containsExactlyElementsOf(EXPECTED);
    }

    @Test
    void preferenceMatches_excludeBlockedDisabledAndBanned() {
        var pool = userRepository.findCandidatesMatchingPreferences(
                "Sisli", Position.WAITER, biz.getId(), LocalDateTime.now());
        assertThat(emails(pool)).containsExactlyElementsOf(EXPECTED);
    }

    @Test
    void availabilityBlockOptIns_excludeBlockedDisabledAndBanned() {
        var pool = userRepository.findCandidatesWithAvailabilityBlocks(biz.getId(), LocalDateTime.now());
        assertThat(emails(pool)).containsExactlyElementsOf(EXPECTED);
    }

    @Test
    void otherBusinessSeesItsOwnBlocksOnly() {
        var pool = userRepository.findAvailableNowCandidates(LocalDateTime.now(), Position.WAITER, otherBiz.getId());
        assertThat(emails(pool)).containsExactly("blocked-biz@test.com", "blocked-by-biz@test.com", "ok@test.com");
    }

    @Test
    void availableNowCount_excludesDisabledAndBanned() {
        // 6 aday: disabled + banned disarida → 4 (sayac engelden bagimsiz, isletme geneli)
        assertThat(userRepository.countAvailableNowCandidates(LocalDateTime.now())).isEqualTo(4);
    }
}
