package com.hotelapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.service.EmailService;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Resend gönderimi gerçek Spring bean'i (circuit breaker proxy'si aktif) üzerinden.
 * Eskiden fallback hatayı yutuyordu → outbox maili "teslim edildi" sanıp tekrar
 * denemiyordu. Artık hata çağırana (OutboxRelay) ulaşmalı.
 */
@SpringBootTest
@ActiveProfiles("test")
class EmailResendHttpTest {

    private static final HttpServer RESEND;
    private static final List<JsonNode> RECEIVED = new CopyOnWriteArrayList<>();

    static {
        try {
            RESEND = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
        RESEND.createContext("/emails", ex -> {
            JsonNode body = new ObjectMapper().readTree(ex.getRequestBody().readAllBytes());
            RECEIVED.add(body);
            boolean reject = body.get("to").get(0).asText().startsWith("reddet");
            byte[] out = (reject
                    ? "{\"statusCode\":403,\"message\":\"The kadrom.me domain is not verified.\"}"
                    : "{\"id\":\"msg_1\"}").getBytes(StandardCharsets.UTF_8);
            ex.getResponseHeaders().add("Content-Type", "application/json");
            ex.sendResponseHeaders(reject ? 403 : 200, out.length);
            ex.getResponseBody().write(out);
            ex.close();
        });
        RESEND.start();
    }

    @DynamicPropertySource
    static void resend(DynamicPropertyRegistry r) {
        r.add("app.email.resend.api-key", () -> "re_test_only");
        r.add("app.email.resend.from", () -> "bildirim@kadrom.me");
        r.add("app.email.resend.base-url", () -> "http://127.0.0.1:" + RESEND.getAddress().getPort());
    }

    @AfterAll
    static void stop() { RESEND.stop(0); }

    @Autowired EmailService emailService;

    @Test
    void resendRejection_isNotSwallowed_soOutboxRetries() {
        assertThatThrownBy(() -> emailService.send("reddet@ornek.com", "Test", "<p>x</p>"))
                .hasMessageContaining("403")
                .hasMessageContaining("not verified");
    }

    @Test
    void successfulSend_usesConfiguredSenderAndRecipient() {
        emailService.send("aday@ornek.com", "Kadrom — Email Doğrulama", "<p>link</p>");

        JsonNode last = RECEIVED.get(RECEIVED.size() - 1);
        assertThat(last.get("from").asText()).isEqualTo("Kadrom <bildirim@kadrom.me>");
        assertThat(last.get("to").get(0).asText()).isEqualTo("aday@ornek.com");
        assertThat(last.get("subject").asText()).isEqualTo("Kadrom — Email Doğrulama");
    }
}
