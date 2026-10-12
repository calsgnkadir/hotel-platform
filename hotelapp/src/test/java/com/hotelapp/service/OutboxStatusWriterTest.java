package com.hotelapp.service;

import com.hotelapp.entity.OutboxEvent;
import com.hotelapp.repository.OutboxEventRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** V26 — Outbox ustel bekleme / DLQ / devre acik erteleme. */
@ExtendWith(MockitoExtension.class)
class OutboxStatusWriterTest {

    @Mock private OutboxEventRepository repo;
    @InjectMocks private OutboxStatusWriter writer;

    private OutboxEvent row(int attempts) {
        OutboxEvent e = OutboxEvent.builder().id(1L).eventType("EMAIL").payload("{}")
                .createdAt(LocalDateTime.now()).attempts(attempts).build();
        when(repo.findById(1L)).thenReturn(Optional.of(e));
        return e;
    }

    @Test
    @DisplayName("Ilk hata: attempts=1, sonraki deneme ~30 sn sonra")
    void firstFailure_backoff30s() {
        OutboxEvent e = row(0);
        LocalDateTime before = LocalDateTime.now();

        writer.markFailed(1L, new IllegalStateException("Resend 503"), OutboxRelay.MAX_ATTEMPTS);

        assertThat(e.getAttempts()).isEqualTo(1);
        assertThat(e.getLastError()).contains("Resend 503");
        assertThat(e.getNextAttemptAt()).isCloseTo(before.plusSeconds(30), within(2, java.time.temporal.ChronoUnit.SECONDS));
        verify(repo).save(e);
    }

    @Test
    @DisplayName("5. hata: bekleme 8 dk (ustel)")
    void fifthFailure_backoff8min() {
        OutboxEvent e = row(4);
        LocalDateTime before = LocalDateTime.now();

        writer.markFailed(1L, new RuntimeException("x"), OutboxRelay.MAX_ATTEMPTS);

        assertThat(e.getAttempts()).isEqualTo(5);
        assertThat(Duration.between(before, e.getNextAttemptAt()).toMinutes()).isBetween(7L, 8L);
    }

    @Test
    @DisplayName("Max deneme: DLQ — attempts=MAX, nextAttemptAt temizlenir")
    void maxAttempts_deadLetter() {
        OutboxEvent e = row(OutboxRelay.MAX_ATTEMPTS - 1);
        e.setNextAttemptAt(LocalDateTime.now());

        writer.markFailed(1L, new RuntimeException("son"), OutboxRelay.MAX_ATTEMPTS);

        assertThat(e.getAttempts()).isEqualTo(OutboxRelay.MAX_ATTEMPTS);
        assertThat(e.getNextAttemptAt()).isNull();
        verify(repo).save(e);
    }

    @Test
    @DisplayName("Devre acik: deneme sayisi artmaz, yalniz ertelenir")
    void deferred_doesNotCountAttempt() {
        OutboxEvent e = row(3);
        LocalDateTime before = LocalDateTime.now();

        writer.markDeferred(1L, Duration.ofSeconds(30), new RuntimeException("CircuitBreaker 'resend' is OPEN"));

        assertThat(e.getAttempts()).isEqualTo(3);
        assertThat(e.getNextAttemptAt()).isAfterOrEqualTo(before.plusSeconds(29));
        assertThat(e.getLastError()).contains("OPEN");
    }
}
