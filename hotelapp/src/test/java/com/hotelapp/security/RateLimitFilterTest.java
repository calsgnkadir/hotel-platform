package com.hotelapp.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockFilterConfig;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class RateLimitFilterTest {

    private RateLimitFilter filter;
    private FilterChain chain;

    @BeforeEach
    void setUp() throws Exception {
        filter = new RateLimitFilter();
        // @Value field'lari manuel set + init
        ReflectionTestUtils.setField(filter, "trustedProxiesCsv", "127.0.0.1,::1");
        ReflectionTestUtils.setField(filter, "rateLimitEnabled", true);
        filter.init(new MockFilterConfig());
        chain = mock(FilterChain.class);
    }

    private MockHttpServletRequest post(String path) {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", path);
        req.setRemoteAddr("10.0.0.1");
        return req;
    }

    @Test
    @DisplayName("FAZ F.1 Sensitive POST /api/messages/conversations/42/messages: 10 OK, 11. 429")
    void sensitiveEndpoint_messageSendPath_limited() throws Exception {
        // F.1 fix: gercek mesaj endpoint path'i (eski exact-match /api/messages bunu kacirir)
        String realPath = "/api/messages/conversations/42/messages";
        for (int i = 0; i < 10; i++) {
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(post(realPath), res, chain);
            assertThat(res.getStatus()).isEqualTo(HttpStatus.OK.value());
        }
        MockHttpServletResponse res11 = new MockHttpServletResponse();
        filter.doFilter(post(realPath), res11, chain);
        assertThat(res11.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        assertThat(res11.getContentAsString()).contains("Too Many Requests");
    }

    @Test
    @DisplayName("FAZ F.1 Sensitive POST /api/messages/conversations (yeni sohbet): limit aktif")
    void sensitiveEndpoint_newConversation_limited() throws Exception {
        for (int i = 0; i < 10; i++) {
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(post("/api/messages/conversations"), res, chain);
            assertThat(res.getStatus()).isEqualTo(HttpStatus.OK.value());
        }
        MockHttpServletResponse res11 = new MockHttpServletResponse();
        filter.doFilter(post("/api/messages/conversations"), res11, chain);
        assertThat(res11.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    @Test
    @DisplayName("Sensitive bucket general bucket'tan ayrik — 60 GET tuketmeyen sensitive limit")
    void sensitiveBucket_isolated_fromGeneralBucket() throws Exception {
        // W4.4 not: /api/listings artik public-read tier'inda (180/dk).
        // General bucket'i doldurmak icin general-tier bir GET path kullaniyoruz.
        String generalPath = "/api/notifications/unread-count";
        // 60 genel GET — general bucket fullen tuketilir
        for (int i = 0; i < 60; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", generalPath);
            req.setRemoteAddr("10.0.0.2");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, chain);
        }
        // Genel artik bos: 61. GET 429 olur
        MockHttpServletRequest gReq = new MockHttpServletRequest("GET", generalPath);
        gReq.setRemoteAddr("10.0.0.2");
        MockHttpServletResponse gRes = new MockHttpServletResponse();
        filter.doFilter(gReq, gRes, chain);
        assertThat(gRes.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());

        // Ama POST /api/messages/conversations hala calisir (ayri bucket — F.1)
        MockHttpServletRequest pReq = new MockHttpServletRequest("POST", "/api/messages/conversations");
        pReq.setRemoteAddr("10.0.0.2");
        MockHttpServletResponse pRes = new MockHttpServletResponse();
        filter.doFilter(pReq, pRes, chain);
        assertThat(pRes.getStatus()).isEqualTo(HttpStatus.OK.value());
    }

    @Test
    @DisplayName("FAZ 11.W4.4 — Public read GET (/api/listings) 180/dk tier'inda: 61. istek hala 200")
    void publicRead_tier_higherQuota() throws Exception {
        // Eski general tier'da (60/dk) 61. istek 429 olurdu — H.5 finding.
        // Public-read tier'inda 180 kota var: 100 istek de rahat gecer.
        for (int i = 0; i < 100; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/listings");
            req.setRemoteAddr("10.0.0.4");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, chain);
            assertThat(res.getStatus()).isEqualTo(HttpStatus.OK.value());
        }
        // 181. istek 429 (kota gercekten sonlu)
        for (int i = 0; i < 80; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/listings");
            req.setRemoteAddr("10.0.0.4");
            filter.doFilter(req, new MockHttpServletResponse(), chain);
        }
        MockHttpServletRequest req181 = new MockHttpServletRequest("GET", "/api/listings");
        req181.setRemoteAddr("10.0.0.4");
        MockHttpServletResponse res181 = new MockHttpServletResponse();
        filter.doFilter(req181, res181, chain);
        assertThat(res181.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    @Test
    @DisplayName("PUT /api/listings/{id}/status sensitive sayilmaz (sadece tam path POST)")
    void putOnListing_isNotSensitive() throws Exception {
        for (int i = 0; i < 15; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("PUT", "/api/listings/42/status");
            req.setRemoteAddr("10.0.0.3");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, chain);
            assertThat(res.getStatus())
                    .as("15. PUT hala 200 olmali (genel bucket 60/dak)")
                    .isEqualTo(HttpStatus.OK.value());
        }
    }
}
