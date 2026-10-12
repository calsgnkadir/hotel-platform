package com.hotelapp.service;

import com.hotelapp.config.AfterCommit;
import com.hotelapp.config.AsyncConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.concurrent.Executor;

/**
 * Yedek bildirim kanalı — SMS. Acil ilan ve yedek (standby) aktivasyonu gibi
 * zamana duyarlı olaylarda push'a EK olarak gönderilir (herkeste app açık değil).
 *
 * <p>İskelet + DEV MODE: {@code app.sms.enabled=false} (varsayılan) iken veya
 * sağlayıcı kimliği girilmemişken gerçek SMS gitmez, log'a düşer. Canlıya geçiş
 * sadece {@code SMS_ENABLED=true} + sağlayıcı (örn. Netgsm) hesabı ile.
 *
 * <p>Best-effort: hiçbir durumda çağıranı patlatmaz — birincil bildirim in-app +
 * web push; SMS onların yanında bir emniyet ağıdır.
 *
 * <p>Asenkron: {@link #send} cagirani bloklamaz. Dis transaction varsa commit
 * SONRASINA ertelenir (geri alinan islemin SMS'i gitmez), sonra {@code smsExecutor}
 * kuyruguna verilir; HTTP cagrisi orada, zaman asimli RestTemplate ile yapilir.
 * Toplu cagiranlar (acil havuz bildirimi) istek icinde saglayiciyi beklemez.
 *
 * <p>WhatsApp: aynı arayüzle ileride provider olarak eklenebilir (BSP hesabı gerekir).
 */
@Service
@Slf4j
public class SmsService {

    private final boolean enabled;
    private final String provider;
    private final String netgsmUsercode;
    private final String netgsmPassword;
    private final String netgsmHeader;
    private final String netgsmUrl;
    private final RestTemplate restTemplate;
    private final Executor executor;

    /** Test/elle kurulum: senkron calisir, varsayilan zaman asimlari. */
    public SmsService(boolean enabled, String provider, String netgsmUsercode, String netgsmPassword,
                      String netgsmHeader, String netgsmUrl) {
        this(enabled, provider, netgsmUsercode, netgsmPassword, netgsmHeader, netgsmUrl,
                Runnable::run, 5000, 10000);
    }

    @Autowired
    public SmsService(
            @Value("${app.sms.enabled:false}")        boolean enabled,
            @Value("${app.sms.provider:netgsm}")      String provider,
            @Value("${app.sms.netgsm.usercode:}")     String netgsmUsercode,
            @Value("${app.sms.netgsm.password:}")     String netgsmPassword,
            @Value("${app.sms.netgsm.header:}")       String netgsmHeader,
            @Value("${app.sms.netgsm.url:https://api.netgsm.com.tr/sms/send/get}") String netgsmUrl,
            @Qualifier("smsExecutor") Executor executor,
            @Value("${app.http.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${app.http.read-timeout-ms:10000}")   int readTimeoutMs) {
        this.restTemplate = new RestTemplate(AsyncConfig.httpRequestFactory(connectTimeoutMs, readTimeoutMs));
        this.executor = executor;
        this.enabled = enabled;
        this.provider = provider;
        this.netgsmUsercode = netgsmUsercode;
        this.netgsmPassword = netgsmPassword;
        this.netgsmHeader = netgsmHeader;
        this.netgsmUrl = netgsmUrl;
    }

    /**
     * Best-effort SMS gönderir: commit sonrası, smsExecutor'da. Kuyruk doluysa SMS
     * atlanır (log). İstisnalar yutulur — çağıranı bloklamaz.
     */
    public void send(String toPhone, String message) {
        try {
            AfterCommit.run(() -> {
                try {
                    executor.execute(() -> sendNow(toPhone, message));
                } catch (Exception e) {
                    log.warn("[SMS] kuyruga alinamadi to={}: {}", mask(toPhone), e.getClass().getSimpleName());
                }
            });
        } catch (Exception e) {
            log.warn("[SMS] planlanamadi to={}: {}", mask(toPhone), e.getClass().getSimpleName());
        }
    }

    /** Teslim — executor thread'inde. Sağlayıcı kapalı/kimlik yoksa DEV MODE'da log'a düşer. */
    void sendNow(String toPhone, String message) {
        String phone = normalize(toPhone);
        if (!enabled || phone == null || netgsmUsercode.isBlank() || netgsmPassword.isBlank()) {
            // KVKK: numara maskeli, mesaj icerigi (OTP kodu olabilir) ASLA loglanmaz.
            log.warn("[SMS DEV MODE] gonderilmedi — to={} ({} karakter)", mask(toPhone),
                    message != null ? message.length() : 0);
            return;
        }
        try {
            if ("netgsm".equalsIgnoreCase(provider)) {
                String url = UriComponentsBuilder.fromHttpUrl(netgsmUrl)
                        .queryParam("usercode", netgsmUsercode)
                        .queryParam("password", netgsmPassword)
                        .queryParam("gsmno", phone)
                        .queryParam("message", message)
                        .queryParam("msgheader", netgsmHeader)
                        .toUriString();
                String resp = restTemplate.getForObject(url, String.class);
                log.info("[SMS] netgsm gonderildi to={} resp={}", mask(phone), resp);
            } else {
                log.warn("[SMS] bilinmeyen saglayici '{}' — gonderilmedi to={}", provider, mask(phone));
            }
        } catch (Exception ex) {
            // ex.getMessage() istek URL'sini (kimlik bilgisi + mesaj) icerebilir: yalniz tip loglanir
            log.warn("[SMS] gonderim basarisiz to={}: {}", mask(phone), ex.getClass().getSimpleName());
        }
    }

    /** Log icin maskeli numara: yalniz son 2 hane (ornek: "*********67"). */
    static String mask(String raw) {
        if (raw == null) return "-";
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.length() <= 2) return "**";
        return "*".repeat(digits.length() - 2) + digits.substring(digits.length() - 2);
    }

    /** Kaba normalize: rakam dışını temizle; en az 10 hane değilse gönderme. */
    private String normalize(String raw) {
        if (raw == null) return null;
        String p = raw.replaceAll("[^0-9]", "");
        return p.length() >= 10 ? p : null;
    }
}
