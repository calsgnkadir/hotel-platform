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
 * RestTemplate ile HTTPS POST → {base-url}/emails (varsayılan https://api.resend.com)
 * Header: Authorization: Bearer {RESEND_API_KEY}
 * Body:   { from, to, subject, html }
 *
 * Gönderici (RESEND_FROM) Resend'de DOĞRULANMIŞ alan adından olmalı (ör.
 * bildirim@kadrom.me). onboarding@resend.dev yalnızca hesap sahibine gönderir.
 *
 * Dev fallback: API key yoksa email içeriği log'a yazılır (test için).
 */
@Service
@Slf4j
public class EmailService {

    private final String apiUrl;
    private final String apiKey;
    private final String fromEmail;
    private final String fromName;
    private final RestTemplate restTemplate;
    private final org.springframework.beans.factory.ObjectProvider<OutboxService> outboxProvider; // FAZ D.9

    public EmailService(
            @Value("${app.email.resend.api-key:}")     String apiKey,
            @Value("${app.email.resend.from:onboarding@resend.dev}") String fromEmail,
            @Value("${app.email.resend.from-name:Kadrom}")       String fromName,
            @Value("${app.email.resend.base-url:https://api.resend.com}") String baseUrl,
            org.springframework.beans.factory.ObjectProvider<OutboxService> outboxProvider,
            // Zaman asimsiz RestTemplate Resend TCP'de asilirsa OutboxRelay'i (ve ayni
            // zamanlayicidaki tum isleri) suresiz bloklardi.
            @Value("${app.http.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${app.http.read-timeout-ms:10000}")   int readTimeoutMs
    ) {
        this.restTemplate = new RestTemplate(
                com.hotelapp.config.AsyncConfig.httpRequestFactory(connectTimeoutMs, readTimeoutMs));
        this.apiKey   = apiKey;
        this.fromEmail = fromEmail;
        this.fromName  = fromName;
        this.apiUrl    = baseUrl.replaceAll("/+$", "") + "/emails";
        this.outboxProvider = outboxProvider;
    }

    /**
     * FAZ D.9 — Domain service'ler bunu cagirir. Email outbox'a yazilir,
     * OutboxRelay scheduler async deliver eder. Resend down olsa bile
     * mesaj kayipsiz: ustel beklemeyle tekrar denenir (max 10 deneme, ~3 saat).
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
     * Email gönderir — OutboxRelay çağırır (kullanıcı isteğini bloklamaz).
     *
     * Hata YUTULMAZ, çağırana fırlatılır: outbox satırı başarısız işaretlenir,
     * ustel beklemeyle tekrar denenir (max 10), sonra son hatayla admin Outbox panelinde görünür.
     * (Eskiden circuit breaker fallback'i hatayı yutuyor, outbox maili "teslim
     * edildi" sanıyordu — yanlış anahtar / doğrulanmamış alan adında mailler
     * sessizce kayboluyordu.) Devre açıkken de CallNotPermittedException fırlar
     * → outbox sonra tekrar dener.
     */
    @CircuitBreaker(name = "resend")
    public void send(String toEmail, String subject, String htmlBody) {
        // Dev fallback: API key yoksa log'a yaz
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("[EMAIL DEV MODE] API key yok — email gönderilmedi:");
            log.warn("  To:      {}", maskEmail(toEmail));
            log.warn("  Subject: {}", subject);
            log.warn("  HTML:    {} karakter (icerik loglanmaz — sifirlama/dogrulama baglantisi icerebilir)", htmlBody.length());
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
            ResponseEntity<String> response = restTemplate.postForEntity(apiUrl, request, String.class);
            log.info("[EMAIL] Gönderildi: to={} subject={} status={}",
                    maskEmail(toEmail), subject, response.getStatusCode());
        } catch (RestClientException e) {
            String safe = safeError(e);
            log.error("[EMAIL] Gönderim hatası: to={} hata={}", maskEmail(toEmail), safe);
            throw new IllegalStateException("Email gönderilemedi: " + safe, e);
        }
    }

    /** Persist the exact attachment before claiming it is queued; never silently fall back to inline delivery. */
    public void queueWithAttachment(String toEmail, String subject, String htmlBody,
                                    String fileName, byte[] content, Long deliveryNoticeUserId) {
        OutboxService outbox = outboxProvider.getIfAvailable();
        if (outbox == null) throw new IllegalStateException("E-posta kuyruğu kullanılamıyor");
        outbox.appendEmail(new com.hotelapp.event.EmailMessage(toEmail, subject, htmlBody,
                new com.hotelapp.event.EmailMessage.Attachment(fileName, content), deliveryNoticeUserId));
    }

    /** Relay-only attachment delivery. Provider errors and open circuits must reach retry handling. */
    @CircuitBreaker(name = "resend")
    public void sendWithAttachment(String toEmail, String subject, String htmlBody,
                                   String fileName, byte[] content) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Ekli e-posta gönderilemedi: e-posta sağlayıcısı yapılandırılmamış");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + apiKey);

        Map<String, Object> body = new HashMap<>();
        body.put("from",    fromName + " <" + fromEmail + ">");
        body.put("to",      new String[]{ toEmail });
        body.put("subject", subject);
        body.put("html",    htmlBody);
        body.put("attachments", java.util.List.of(Map.of(
                "filename", fileName,
                "content",  java.util.Base64.getEncoder().encodeToString(content))));
        try {
            restTemplate.postForEntity(apiUrl, new HttpEntity<>(body, headers), String.class);
            log.info("[EMAIL] Ekli gönderildi: to={} subject={} ek={}", maskEmail(toEmail), subject, fileName);
        } catch (RestClientException e) {
            String safe = safeError(e);
            log.error("[EMAIL] Ekli gönderim hatası: to={} hata={}", maskEmail(toEmail), safe);
            throw new IllegalStateException("Email gönderilemedi: " + safe, e);
        }
    }

    /**
     * Eski API uyumlulugu: PasswordResetService bu metodu cagiriyor.
     * Yeni EmailTemplates.passwordReset()'e delegate eder.
     * (Mevcut testleri/cagirici kodu bozmamak icin korundu.)
     */
    public String buildPasswordResetHtml(String userName, String resetLink) {
        return new EmailTemplates().passwordReset(userName, resetLink);
    }

    private static final com.fasterxml.jackson.databind.ObjectMapper JSON =
            new com.fasterxml.jackson.databind.ObjectMapper();

    /**
     * KVKK: saglayici hata metni (yanit govdesi) alici adresini icerebilir. Loga ve
     * outbox last_error'a yalniz durum kodu / hata sinifi + maskeli kisa mesaj gider.
     * Resend govdesi JSON ise yalniz "message" alani alinir.
     */
    static String safeError(RestClientException e) {
        if (e instanceof org.springframework.web.client.RestClientResponseException r) {
            String body = r.getResponseBodyAsString();
            String msg = body;
            try {
                var node = JSON.readTree(body);
                if (node != null && node.hasNonNull("message")) msg = node.get("message").asText();
            } catch (Exception ignored) {
                // JSON degil: ham govde maskelenip kisaltilir
            }
            return "HTTP " + r.getStatusCode().value() + (msg == null || msg.isBlank() ? "" : " " + shortMasked(msg));
        }
        return e.getClass().getSimpleName() + ": " + shortMasked(e.getMessage());
    }

    private static String shortMasked(String text) {
        if (text == null) return "";
        String m = com.hotelapp.security.PiiMasking.scrub(text);
        return m.length() > 200 ? m.substring(0, 200) + "…" : m;
    }

    /** KVKK: loglarda tam e-posta yok — "a***@a***.com" ({@link com.hotelapp.security.PiiMasking#email}). */
    static String maskEmail(String email) {
        return com.hotelapp.security.PiiMasking.email(email);
    }
}
