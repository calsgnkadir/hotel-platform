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
            log.error("[EMAIL] Gönderim hatası: to={} hata={}", maskEmail(toEmail), e.getMessage());
            throw new IllegalStateException("Email gönderilemedi: " + e.getMessage(), e);
        }
    }

    /**
     * Ek dosyalı e-posta (ekip listesi .xlsx). Outbox'a yazılmaz — ek büyük ve
     * gönderilemezse liste panelden indirilebilir durumda; kayıp kritik değil.
     */
    @CircuitBreaker(name = "resend", fallbackMethod = "sendWithAttachmentFallback")
    public void sendWithAttachment(String toEmail, String subject, String htmlBody,
                                   String fileName, byte[] content) {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("[EMAIL DEV MODE] API key yok — ekli email gönderilmedi: to={} subject={} ek={} ({} bayt)",
                    maskEmail(toEmail), subject, fileName, content.length);
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
        body.put("attachments", java.util.List.of(Map.of(
                "filename", fileName,
                "content",  java.util.Base64.getEncoder().encodeToString(content))));
        try {
            restTemplate.postForEntity(apiUrl, new HttpEntity<>(body, headers), String.class);
            log.info("[EMAIL] Ekli gönderildi: to={} subject={} ek={}", maskEmail(toEmail), subject, fileName);
        } catch (RestClientException e) {
            log.error("[EMAIL] Ekli gönderim hatası: to={} hata={}", maskEmail(toEmail), e.getMessage());
            throw new IllegalStateException("Email gönderilemedi: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unused")
    private void sendWithAttachmentFallback(String toEmail, String subject, String htmlBody,
                                           String fileName, byte[] content, Throwable t) {
        log.warn("[EMAIL][CB-FALLBACK] ekli email atlandı - to={} subject={} sebep={}",
                maskEmail(toEmail), subject, t.getMessage());
    }

    /**
     * Eski API uyumlulugu: PasswordResetService bu metodu cagiriyor.
     * Yeni EmailTemplates.passwordReset()'e delegate eder.
     * (Mevcut testleri/cagirici kodu bozmamak icin korundu.)
     */
    public String buildPasswordResetHtml(String userName, String resetLink) {
        return new EmailTemplates().passwordReset(userName, resetLink);
    }

    /** KVKK: loglarda tam e-posta yok — "a***@a***.com" ({@link com.hotelapp.security.PiiMasking#email}). */
    static String maskEmail(String email) {
        return com.hotelapp.security.PiiMasking.email(email);
    }
}
