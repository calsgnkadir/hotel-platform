package com.hotelapp.security.oauth;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Hangi harici giriş yöntemleri gerçekten çalışır durumda?
 *
 * Google girişi yalnızca gerçek bir OAuth istemcisi girilmişse açık sayılır:
 * istemci kimliği "...apps.googleusercontent.com" ile biter ve gizli anahtar
 * doluysa. Sahte/varsayılan değerlerde (not-configured, test, dummy) kapalıdır;
 * frontend Google butonunu ve "veya" ayracını hiç göstermez — kullanıcı kırık
 * bir butona tıklayıp Google'ın "invalid_client" hata sayfasını görmez.
 */
@Component
@Slf4j
public class OAuthProviders {

    static final String NOT_CONFIGURED = "not-configured";
    private static final String GOOGLE_CLIENT_SUFFIX = ".apps.googleusercontent.com";

    private final boolean googleEnabled;

    public OAuthProviders(
            @Value("${spring.security.oauth2.client.registration.google.client-id:}") String clientId,
            @Value("${spring.security.oauth2.client.registration.google.client-secret:}") String clientSecret) {
        this.googleEnabled = isRealGoogleClient(clientId, clientSecret);
        if (!googleEnabled) {
            log.info("[OAUTH] Google girişi kapalı (GOOGLE_CLIENT_ID/SECRET gerçek değil) — buton gizlenir.");
        }
    }

    static boolean isRealGoogleClient(String clientId, String clientSecret) {
        if (clientId == null || clientSecret == null) return false;
        String id = clientId.trim();
        String secret = clientSecret.trim();
        return id.endsWith(GOOGLE_CLIENT_SUFFIX) && id.length() > GOOGLE_CLIENT_SUFFIX.length()
                && !secret.isEmpty() && !NOT_CONFIGURED.equals(secret);
    }

    public boolean googleEnabled() {
        return googleEnabled;
    }
}
