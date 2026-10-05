package com.hotelapp.security.oauth;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OAuthProvidersTest {

    @Test
    void realGoogleClient_isEnabled() {
        assertThat(new OAuthProviders("1234567890-abc.apps.googleusercontent.com", "GOCSPX-secret").googleEnabled())
                .isTrue();
    }

    @Test
    void placeholderOrFakeValues_areDisabled() {
        String[][] fakes = {
                {"not-configured", "not-configured"},      // varsayılan (ayarlanmamış)
                {"dummy-client-id", "dummy-client-secret"}, // render.yaml vitrin
                {"test-client-id", "test-client-secret"},   // test profili
                {"", ""},
                {"1234567890-abc.apps.googleusercontent.com", ""},              // gizli anahtar yok
                {"1234567890-abc.apps.googleusercontent.com", "not-configured"},
                {".apps.googleusercontent.com", "secret"},                      // sadece sonek
        };
        for (String[] f : fakes) {
            assertThat(new OAuthProviders(f[0], f[1]).googleEnabled())
                    .as("client-id=%s secret=%s", f[0], f[1]).isFalse();
        }
        assertThat(new OAuthProviders(null, null).googleEnabled()).isFalse();
    }
}
