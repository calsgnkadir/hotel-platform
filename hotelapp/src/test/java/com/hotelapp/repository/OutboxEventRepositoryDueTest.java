package com.hotelapp.repository;

import com.hotelapp.entity.OutboxEvent;
import com.hotelapp.service.OutboxRelay;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/** V26 — relay yalniz zamani gelmis (next_attempt_at NULL ya da gecmis) ve DLQ olmayanlari alir. */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.ANY)
class OutboxEventRepositoryDueTest {

    @Autowired private OutboxEventRepository repo;

    private OutboxEvent save(String tag, int attempts, LocalDateTime next, LocalDateTime processed) {
        return repo.save(OutboxEvent.builder().eventType("EMAIL").payload(tag)
                .createdAt(LocalDateTime.now().minusMinutes(5)).attempts(attempts)
                .nextAttemptAt(next).processedAt(processed).build());
    }

    @Test
    void findDue_skipsFutureDeadAndProcessed() {
        LocalDateTime now = LocalDateTime.now();
        save("yeni", 0, null, null);
        save("vadesi-gecmis", 2, now.minusSeconds(1), null);
        save("gelecek", 2, now.plusMinutes(4), null);
        save("dlq", OutboxRelay.MAX_ATTEMPTS, null, null);
        save("teslim", 0, null, now.minusMinutes(1));

        var due = repo.findDue(OutboxRelay.MAX_ATTEMPTS, now, PageRequest.of(0, 20));

        assertThat(due).extracting(OutboxEvent::getPayload)
                .containsExactlyInAnyOrder("yeni", "vadesi-gecmis");
    }
}
