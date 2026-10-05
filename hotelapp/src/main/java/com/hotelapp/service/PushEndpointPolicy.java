package com.hotelapp.service;

import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Locale;
import java.util.Set;

/**
 * Push abonelik adresi doğrulaması (SSRF koruması).
 *
 * Sunucu, kayıtlı adrese HTTP POST atar. Adres kullanıcıdan geldiği için
 * yalnızca tarayıcıların gerçek push servislerine izin verilir; aksi halde biri
 * http://127.0.0.1/... ya da iç ağ adresi kaydedip sunucuya istek attırabilir.
 * Yönlendirme izlenmez (HttpClient varsayılanı NEVER).
 */
@Component
public class PushEndpointPolicy {

    private static final int MAX_LENGTH = 500;   // push_subscriptions.endpoint kolonu

    /** Chrome/Edge (FCM), Firefox, Safari. */
    private static final Set<String> HOSTS = Set.of(
            "fcm.googleapis.com",
            "android.googleapis.com",
            "updates.push.services.mozilla.com",
            "web.push.apple.com");

    /** Alt alan adıyla gelen servisler (Apple bölgesel, Windows WNS, Mozilla). */
    private static final Set<String> SUFFIXES = Set.of(
            ".push.apple.com",
            ".notify.windows.com",
            ".push.services.mozilla.com");

    public boolean isAllowed(String endpoint) {
        if (endpoint == null || endpoint.isBlank() || endpoint.length() > MAX_LENGTH) return false;
        URI uri;
        try {
            uri = new URI(endpoint);
        } catch (Exception e) {
            return false;
        }
        if (!"https".equalsIgnoreCase(uri.getScheme())) return false;
        if (uri.getRawUserInfo() != null) return false;
        if (uri.getPort() != -1 && uri.getPort() != 443) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase(Locale.ROOT);
        if (HOSTS.contains(host)) return true;
        for (String suffix : SUFFIXES) {
            if (host.endsWith(suffix)) return true;
        }
        return false;
    }
}
