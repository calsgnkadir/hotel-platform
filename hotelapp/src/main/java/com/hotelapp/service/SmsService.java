package com.hotelapp.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

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
    private final RestTemplate restTemplate = new RestTemplate();

    public SmsService(
            @Value("${app.sms.enabled:false}")        boolean enabled,
            @Value("${app.sms.provider:netgsm}")      String provider,
            @Value("${app.sms.netgsm.usercode:}")     String netgsmUsercode,
            @Value("${app.sms.netgsm.password:}")     String netgsmPassword,
            @Value("${app.sms.netgsm.header:}")       String netgsmHeader,
            @Value("${app.sms.netgsm.url:https://api.netgsm.com.tr/sms/send/get}") String netgsmUrl) {
        this.enabled = enabled;
        this.provider = provider;
        this.netgsmUsercode = netgsmUsercode;
        this.netgsmPassword = netgsmPassword;
        this.netgsmHeader = netgsmHeader;
        this.netgsmUrl = netgsmUrl;
    }

    /**
     * Best-effort SMS gönderir. Sağlayıcı kapalı/kimlik yoksa DEV MODE'da log'a
     * düşer (gerçek SMS gitmez). İstisnalar yutulur — çağıranı bloklamaz.
     */
    public void send(String toPhone, String message) {
        String phone = normalize(toPhone);
        if (!enabled || phone == null || netgsmUsercode.isBlank() || netgsmPassword.isBlank()) {
            log.warn("[SMS DEV MODE] gonderilmedi — to={} msg={}", toPhone,
                    message != null ? message.substring(0, Math.min(120, message.length())) : "");
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
                log.info("[SMS] netgsm gonderildi to={} resp={}", phone, resp);
            } else {
                log.warn("[SMS] bilinmeyen saglayici '{}' — gonderilmedi to={}", provider, phone);
            }
        } catch (Exception ex) {
            log.warn("[SMS] gonderim basarisiz to={}: {}", phone, ex.getMessage());
        }
    }

    /** Kaba normalize: rakam dışını temizle; en az 10 hane değilse gönderme. */
    private String normalize(String raw) {
        if (raw == null) return null;
        String p = raw.replaceAll("[^0-9]", "");
        return p.length() >= 10 ? p : null;
    }
}
