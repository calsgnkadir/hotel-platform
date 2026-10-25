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

    @Test
    @DisplayName("KVKK: başarılı EMAIL teslimi sonrası html gövdesi boşaltılır, alıcı maskelenir")
    void markProcessed_email_redactsBody() throws Exception {
        OutboxEvent e = row(1);
        e.setPayload("{\"to\":\"tam.adres@ornek.com\",\"subject\":\"Kadrom — Email Doğrulama\","
                + "\"html\":\"<a href='https://kadrom.me/verify?token=GIZLI123'>doğrula</a>\"}");

        writer.markProcessed(1L);

        assertThat(e.getProcessedAt()).isNotNull();
        var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(e.getPayload());
        assertThat(node.get("to").asText()).isEqualTo("t***@o***.com");
        assertThat(node.get("subject").asText()).isEqualTo("Kadrom — Email Doğrulama");
        assertThat(node.get("html").asText()).isEmpty();
        assertThat(e.getPayload()).doesNotContain("GIZLI123", "tam.adres");
        verify(repo).save(e);
    }

    @Test
    @DisplayName("Başarılı AUDIT_LOG teslimi payload'a dokunmaz")
    void markProcessed_audit_keepsPayload() {
        OutboxEvent e = row(0);
        e.setEventType("AUDIT_LOG");
        e.setPayload("{\"action\":\"X\"}");

        writer.markProcessed(1L);

        assertThat(e.getPayload()).isEqualTo("{\"action\":\"X\"}");
    }

    @Test
    @DisplayName("Bozuk EMAIL payload'ı da teslim sonrası gövdesiz hale gelir")
    void redact_unparseable() {
        String out = OutboxStatusWriter.redactDeliveredEmail("bozuk <a href=reset?token=X>");
        assertThat(out).doesNotContain("token").contains("\"html\":\"\"");
    }

    @Test
    @DisplayName("KVKK: last_error'da e-posta yok; HTTP durum kodu + hata sınıfı kalır")
    void markFailed_masksEmailAndKeepsStatus() {
        OutboxEvent e = row(0);
        var http = org.springframework.web.client.HttpClientErrorException.create(
                org.springframework.http.HttpStatus.FORBIDDEN, "Forbidden", new org.springframework.http.HttpHeaders(),
                "{\"message\":\"only to owner@resend-hesap.com\"}".getBytes(), null);
        var ex = new IllegalStateException("Email gönderilemedi: alıcı tam.adres@ornek.com", http);

        writer.markFailed(1L, ex, OutboxRelay.MAX_ATTEMPTS);

        assertThat(e.getLastError())
                .startsWith("IllegalStateException HTTP 403")
                .contains("t***@o***.com")
                .doesNotContain("tam.adres", "owner@");
    }
}
