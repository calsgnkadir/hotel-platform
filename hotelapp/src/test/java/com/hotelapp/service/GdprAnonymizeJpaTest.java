package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * KVKK anonimleştirmesi gerçek JPA + H2 ile: {@code users.password} V1'deki gibi NOT NULL.
 * Eskiden {@code setPassword(null)} MySQL'de flush'ta patlıyor ve (tek transaction olduğu
 * için) o geceki tüm anonimleştirmeyi geri alıyordu.
 *
 * <p>Test transaction'sız çalışır: servis kullanıcı başına REQUIRES_NEW açar; kayıtlar
 * commit edilmiş olmalı.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
@Import(GdprService.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class GdprAnonymizeJpaTest {

    @Autowired private GdprService gdprService;
    @Autowired private UserRepository userRepository;
    @Autowired private JdbcTemplate jdbc;

    @MockBean private OutboxService outboxService;
    @MockBean private RefreshTokenService refreshTokenService;
    @MockBean private AccountClosureService accountClosureService;
    @MockBean private FileStorageService fileStorageService;

    @BeforeEach
    void enforceNotNullLikeMysql() {
        // Hibernate'in ürettiği H2 şemasında kolon nullable; üretim şeması (V1) NOT NULL.
        jdbc.execute("ALTER TABLE users ALTER COLUMN password SET NOT NULL");
    }

    private User dueUser(String rawPassword) {
        return userRepository.save(User.builder()
                .email("kvkk-" + UUID.randomUUID() + "@test.com")
                .password(new BCryptPasswordEncoder().encode(rawPassword))
                .fullName("Silinecek Kisi").role(Role.CANDIDATE).enabled(false)
                .phone("05551234567")
                .deletionRequestedAt(LocalDateTime.now().minusDays(31))
                .scheduledAnonymizeAt(LocalDateTime.now().minusDays(1))
                .build());
    }

    @Test
    @DisplayName("NOT NULL kısıtı gerçekten aktif: parolası null kullanıcı yazılamaz")
    void constraintIsActive() {
        User u = dueUser("Eski1234");
        u.setPassword(null);
        assertThatThrownBy(() -> userRepository.saveAndFlush(u))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Anonimleştirme flush/commit edilir; parola boş değil ve hiçbir parolayla eşleşmez")
    void anonymize_persistsWithUnusablePassword() {
        User a = dueUser("Eski1234");
        User b = dueUser("Baska5678");

        gdprService.anonymizeDueAccounts();

        BCryptPasswordEncoder enc = new BCryptPasswordEncoder();
        for (User before : new User[]{a, b}) {
            User after = userRepository.findById(before.getId()).orElseThrow();
            assertThat(after.getEmail()).isEqualTo("deleted-" + before.getId() + "@deleted.local");
            assertThat(after.getFullName()).isEqualTo("Silinmiş Kullanıcı");
            assertThat(after.getPhone()).isNull();
            assertThat(after.getScheduledAnonymizeAt()).isNull();
            assertThat(after.getPassword()).isNotBlank().startsWith("$2");
            assertThat(after.getPassword()).isNotEqualTo(before.getPassword());
            for (String guess : new String[]{"Eski1234", "Baska5678", "", "null", "UNUSABLE-"}) {
                assertThat(enc.matches(guess, after.getPassword())).isFalse();
            }
        }
        // İki kullanıcının özeti farklı (her biri ayrı rastgele girdiden)
        assertThat(userRepository.findById(a.getId()).orElseThrow().getPassword())
                .isNotEqualTo(userRepository.findById(b.getId()).orElseThrow().getPassword());
    }
}
