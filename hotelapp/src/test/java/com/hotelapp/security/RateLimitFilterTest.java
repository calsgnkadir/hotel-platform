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
    @DisplayName("Sensitive POST /api/messages: 10 istek gecer, 11. 429 doner")
    void sensitiveEndpoint_limitedTo10PerMinute() throws Exception {
        for (int i = 0; i < 10; i++) {
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(post("/api/messages"), res, chain);
            assertThat(res.getStatus()).isEqualTo(HttpStatus.OK.value());
        }
        MockHttpServletResponse res11 = new MockHttpServletResponse();
        filter.doFilter(post("/api/messages"), res11, chain);
        assertThat(res11.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        assertThat(res11.getContentAsString()).contains("Too Many Requests");
    }

    @Test
    @DisplayName("Sensitive bucket general bucket'tan ayrik — 60 GET tuketmeyen sensitive limit")
    void sensitiveBucket_isolated_fromGeneralBucket() throws Exception {
        // 60 genel GET — general bucket fullen tuketilir
        for (int i = 0; i < 60; i++) {
            MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/listings");
            req.setRemoteAddr("10.0.0.2");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, chain);
        }
        // Genel artik bos: 61. GET 429 olur
        MockHttpServletRequest gReq = new MockHttpServletRequest("GET", "/api/listings");
        gReq.setRemoteAddr("10.0.0.2");
        MockHttpServletResponse gRes = new MockHttpServletResponse();
        filter.doFilter(gReq, gRes, chain);
        assertThat(gRes.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());

        // Ama POST /api/messages hala calisir (ayri bucket)
        MockHttpServletRequest pReq = new MockHttpServletRequest("POST", "/api/messages");
        pReq.setRemoteAddr("10.0.0.2");
        MockHttpServletResponse pRes = new MockHttpServletResponse();
        filter.doFilter(pReq, pRes, chain);
        assertThat(pRes.getStatus()).isEqualTo(HttpStatus.OK.value());
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
