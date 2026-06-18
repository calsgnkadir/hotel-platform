package com.hotelapp.integration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * FAZ D.3 — Security response header'lari her response'a yazilmali.
 * Public endpoint uzerinden dogrulanir (auth gerek yok).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SecurityHeadersIT {

    @Autowired private MockMvc mvc;

    @Test
    @DisplayName("Public endpoint response'unda tum security header'lar var")
    void headersPresentOnPublicEndpoint() throws Exception {
        mvc.perform(get("/api/listings"))
                .andExpect(status().isOk())
                // X-Frame-Options: DENY (clickjacking)
                .andExpect(header().string("X-Frame-Options", "DENY"))
                // X-Content-Type-Options: nosniff (Spring default)
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                // Referrer-Policy
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"))
                // CSP: tum 'none'
                .andExpect(header().string("Content-Security-Policy",
                        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"))
                // Permissions-Policy
                .andExpect(header().string("Permissions-Policy",
                        "camera=(), microphone=(), geolocation=(self), payment=()"));
    }
}
