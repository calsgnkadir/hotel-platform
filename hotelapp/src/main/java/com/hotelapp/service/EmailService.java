package com.hotelapp.service;

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

    public EmailService(
            @Value("${app.email.resend.api-key:}")     String apiKey,
            @Value("${app.email.resend.from:onboarding@resend.dev}") String fromEmail,
            @Value("${app.email.resend.from-name:AjansHotel}")       String fromName
    ) {
        this.apiKey   = apiKey;
        this.fromEmail = fromEmail;
        this.fromName  = fromName;
    }

    /**
     * Email gönderir. Asenkron değil — controller thread'inde çalışır.
     * Hata durumunda exception fırlatır; çağıran handle eder.
     */
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
            throw new RuntimeException("Email gönderilemedi: " + e.getMessage(), e);
        }
    }

    /** Şifre sıfırlama email içeriğini hazırlar (HTML template). */
    public String buildPasswordResetHtml(String userName, String resetLink) {
        return """
            <!DOCTYPE html>
            <html lang="tr">
            <head><meta charset="utf-8"></head>
            <body style="margin:0; padding:0; background:#0a0f1c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%%" style="background:#0a0f1c; padding:40px 20px;">
                <tr><td align="center">
                  <table cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px; background:#0f172a; border-radius:16px; border:1px solid #1e293b; overflow:hidden;">
                    <tr><td style="height:3px; background:linear-gradient(90deg,#10b981,#34d399,#10b981);"></td></tr>

                    <tr><td style="padding:32px 32px 16px;">
                      <h1 style="margin:0; font-size:28px; font-weight:900; letter-spacing:-0.5px; color:#ffffff;">
                        AjansHotel
                      </h1>
                      <p style="margin:4px 0 0; font-size:11px; letter-spacing:3px; text-transform:uppercase; color:#64748b;">
                        İSTANBUL
                      </p>
                    </td></tr>

                    <tr><td style="padding:8px 32px 24px;">
                      <h2 style="margin:0 0 16px; font-size:20px; font-weight:700; color:#f1f5f9;">
                        Şifre Sıfırlama Talebi
                      </h2>
                      <p style="margin:0 0 16px; font-size:14px; line-height:1.6; color:#cbd5e1;">
                        Merhaba %s,
                      </p>
                      <p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#cbd5e1;">
                        AjansHotel hesabın için şifre sıfırlama talebi aldık. Aşağıdaki butona tıklayarak
                        yeni bir şifre belirleyebilirsin.
                      </p>

                      <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px 0 24px;">
                        <tr><td align="center" style="border-radius:9999px; background:linear-gradient(135deg,#047857,#10b981); padding:14px 32px;">
                          <a href="%s" style="font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; display:inline-block;">
                            Şifremi Sıfırla &rarr;
                          </a>
                        </td></tr>
                      </table>

                      <p style="margin:0 0 8px; font-size:12px; line-height:1.6; color:#94a3b8;">
                        Buton çalışmıyorsa, aşağıdaki bağlantıyı tarayıcına kopyala-yapıştır:
                      </p>
                      <p style="margin:0 0 24px; font-size:11px; line-height:1.5; color:#10b981; word-break:break-all; font-family:'SF Mono', Consolas, monospace;">
                        %s
                      </p>

                      <p style="margin:24px 0 0; padding:16px; background:#1e293b; border-radius:12px; font-size:12px; line-height:1.6; color:#94a3b8;">
                        <strong style="color:#cbd5e1;">⚠ Bu bağlantı 1 saat geçerlidir.</strong><br>
                        Şifre sıfırlama talebinde bulunmadıysan bu maili görmezden gelebilirsin —
                        hesabın güvende kalmaya devam eder.
                      </p>
                    </td></tr>

                    <tr><td style="padding:20px 32px; border-top:1px solid #1e293b;">
                      <p style="margin:0; font-size:11px; line-height:1.5; color:#475569;">
                        AjansHotel &middot; İstanbul &middot; 2026<br>
                        Bu otomatik bir maildir, yanıtlama.
                      </p>
                    </td></tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
            """.formatted(userName, resetLink, resetLink);
    }
}
