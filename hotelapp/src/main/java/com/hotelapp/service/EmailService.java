package com.hotelapp.service;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * #80: Resend ile email gönderim servisi.
 *
 * RestTemplate ile HTTPS POST → https://api.resend.com/emails
 * Header: Authorization: Bearer {RESEND_API_KEY}
 * Body:   { from, to, subject, html }
 *
 * Dev fallback: API key yoksa email içeriği log'a yazılır (test için).
 */
@Service
@Slf4j
public class EmailService {

    private static final String RESEND_API_URL = "https://api.resend.com/emails";

    private final String apiKey;
    private final String fromEmail;
    private final String fromName;
    private final RestTemplate restTemplate = new RestTemplate();
    private final org.springframework.beans.factory.ObjectProvider<OutboxService> outboxProvider; // FAZ D.9

    public EmailService(
            @Value("${app.email.resend.api-key:}")     String apiKey,
            @Value("${app.email.resend.from:onboarding@resend.dev}") String fromEmail,
            @Value("${app.email.resend.from-name:AjansHotel}")       String fromName,
            org.springframework.beans.factory.ObjectProvider<OutboxService> outboxProvider
    ) {
        this.apiKey   = apiKey;
        this.fromEmail = fromEmail;
        this.fromName  = fromName;
        this.outboxProvider = outboxProvider;
    }

    /**
     * FAZ D.9 — Domain service'ler bunu cagirir. Email outbox'a yazilir,
     * OutboxRelay scheduler async deliver eder. Resend down olsa bile
     * mesaj kayipsiz: bir sonraki tick'te tekrar denenir (max 5 deneme).
     *
     * outboxProvider null ise (test/dev erken yukleme), inline send fallback.
     */
    public void queue(String toEmail, String subject, String htmlBody) {
        OutboxService outbox = outboxProvider.getIfAvailable();
        if (outbox != null) {
            outbox.appendEmail(new com.hotelapp.event.EmailMessage(toEmail, subject, htmlBody));
        } else {
            log.warn("[EMAIL] OutboxService yok, inline send fallback");
            send(toEmail, subject, htmlBody);
        }
    }

    /**
     * Email gönderir. Asenkron değil — controller thread'inde çalışır.
     * FAZ 2/#18: Resend down/yavaslarsa devre acilir, fallback log atip sessiz kalir
     * (kullanici reset isteyebilir, login akisi blok olmaz).
     */
    @CircuitBreaker(name = "resend", fallbackMethod = "sendFallback")
    public void send(String toEmail, String subject, String htmlBody) {
        // Dev fallback: API key yoksa log'a yaz
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("[EMAIL DEV MODE] API key yok — email gönderilmedi:");
            log.warn("  To:      {}", toEmail);
            log.warn("  Subject: {}", subject);
            log.warn("  HTML:    {}", htmlBody.substring(0, Math.min(500, htmlBody.length())));
            return;
        }

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + apiKey);

        Map<String, Object> body = new HashMap<>();
        body.put("from",    fromName + " <" + fromEmail + ">");
        body.put("to",      new String[]{ toEmail });
        body.put("subject", subject);
        body.put("html",    htmlBody);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(RESEND_API_URL, request, String.class);
            log.info("[EMAIL] Gönderildi: to={} subject={} status={}",
                    toEmail, subject, response.getStatusCode());
        } catch (RestClientException e) {
            log.error("[EMAIL] Gönderim hatası: to={} hata={}", toEmail, e.getMessage());
            throw new IllegalStateException("Email gönderilemedi: " + e.getMessage(), e);
        }
    }

    /** FAZ 2/#18 - Circuit breaker fallback: Resend down ise sessiz log */
    @SuppressWarnings("unused")
    private void sendFallback(String toEmail, String subject, String htmlBody, Throwable t) {
        log.warn("[EMAIL][CB-FALLBACK] Resend devre disi/timeout - to={} subject={} sebep={}",
                toEmail, subject, t.getMessage());
        // Email yutuldu - kullanici tekrar deneyebilir. Login akisini bloklamiyoruz.
    }

    /**
     * Eski API uyumlulugu: PasswordResetService bu metodu cagiriyor.
     * Yeni EmailTemplates.passwordReset()'e delegate eder.
     * (Mevcut testleri/cagirici kodu bozmamak icin korundu.)
     */
    public String buildPasswordResetHtml(String userName, String resetLink) {
        return new EmailTemplates().passwordReset(userName, resetLink);
    }
}
