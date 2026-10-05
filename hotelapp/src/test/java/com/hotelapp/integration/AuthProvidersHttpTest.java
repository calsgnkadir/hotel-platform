package com.hotelapp.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Giriş yöntemleri ucu: girişsiz erişilir; Google ayarlanmamışken kapalı döner.
 * GOOGLE_* env yokken application.yml varsayılanı 'not-configured' — bu değerlerle
 * Spring'in OAuth2 istemcisi ayağa kalkabilmeli (eskiden boş değer sunucuyu
 * "Client id must not be empty" ile çökertiyordu).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
        "spring.security.oauth2.client.registration.google.client-id=not-configured",
        "spring.security.oauth2.client.registration.google.client-secret=not-configured",
})
class AuthProvidersHttpTest {

    @Autowired MockMvc mvc;

    @Test
    void appBootsWithoutGoogle_andProvidersSaysGoogleOff() throws Exception {
        mvc.perform(get("/api/auth/providers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.google").value(false));
    }
}
