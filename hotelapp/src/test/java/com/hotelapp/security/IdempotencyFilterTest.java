package com.hotelapp.security;

import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class IdempotencyFilterTest {

    private IdempotencyService service;
    private IdempotencyFilter filter;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        service = new IdempotencyService();
        ReflectionTestUtils.setField(service, "ttlMinutes", 60L);
        // FAZ D.4 — AppMetrics opsiyonel; test'te bos provider
        @SuppressWarnings({"unchecked", "rawtypes"})
        org.springframework.beans.factory.ObjectProvider noMetricsRaw =
                mock(org.springframework.beans.factory.ObjectProvider.class);
        org.mockito.Mockito.when(noMetricsRaw.getIfAvailable()).thenReturn(null);
        @SuppressWarnings("unchecked")
        org.springframework.beans.factory.ObjectProvider<com.hotelapp.metrics.AppMetrics> noMetrics = noMetricsRaw;
        filter = new IdempotencyFilter(service, noMetrics);
        chain = mock(FilterChain.class);
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    private void authAs(long userId) {
        User u = new User();
        u.setId(userId);
        u.setEmail("u" + userId + "@x.com");
        u.setRole(Role.CANDIDATE);
        u.setEnabled(true);
        UserPrincipal principal = new UserPrincipal(u);
        var auth = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Test
    @DisplayName("POST + no Idempotency-Key: chain calistirilir, cache bypass")
    void postWithoutHeader_bypasses() throws Exception {
        authAs(1L);
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/applications");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        verify(chain, times(1)).doFilter(any(), any());
        assertThat(service.find("1:any")).isNull();
    }

    @Test
    @DisplayName("GET ile Idempotency-Key bile olsa bypass (sadece POST gozlenir)")
    void getMethod_alwaysBypasses() throws Exception {
        authAs(1L);
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/listings");
        req.addHeader(IdempotencyFilter.HEADER, "key-abc");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        verify(chain, times(1)).doFilter(any(), any());
    }

    @Test
    @DisplayName("Cache hit: chain CAGRILMAZ, cached response donulur + X-Idempotent-Replay header")
    void cacheHit_returnsStoredResponse() throws Exception {
        authAs(42L);
        service.store("42:my-key", 201, "{\"id\":99}");

        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/applications");
        req.addHeader(IdempotencyFilter.HEADER, "my-key");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, chain);

        verify(chain, never()).doFilter(any(), any());
        assertThat(res.getStatus()).isEqualTo(201);
        assertThat(res.getContentAsString()).isEqualTo("{\"id\":99}");
        assertThat(res.getHeader("X-Idempotent-Replay")).isEqualTo("true");
    }

    @Test
    @DisplayName("Cache miss: chain calistirilir, 2xx response cache'lenir")
    void cacheMiss_storesAfterSuccess() throws Exception {
        authAs(7L);
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/applications");
        req.addHeader(IdempotencyFilter.HEADER, "fresh-key");
        MockHttpServletResponse res = new MockHttpServletResponse();

        // Chain controller'i simule eder: status 201 + body yazar
        org.mockito.Mockito.doAnswer(inv -> {
            var wrappedRes = (jakarta.servlet.http.HttpServletResponse) inv.getArgument(1);
            wrappedRes.setStatus(201);
            wrappedRes.setContentType("application/json");
            wrappedRes.getWriter().write("{\"created\":true}");
            return null;
        }).when(chain).doFilter(any(), any());

        filter.doFilter(req, res, chain);

        verify(chain, times(1)).doFilter(any(), any());
        var cached = service.find("7:fresh-key");
        assertThat(cached).isNotNull();
        assertThat(cached.status()).isEqualTo(201);
        assertThat(cached.body()).contains("\"created\":true");
    }

    @Test
    @DisplayName("Cache miss + 4xx response: cache'e YAZILMAZ (client retry edebilir)")
    void cacheMiss_doesNotStoreOnClientError() throws Exception {
        authAs(8L);
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/applications");
        req.addHeader(IdempotencyFilter.HEADER, "validation-fail-key");
        MockHttpServletResponse res = new MockHttpServletResponse();

        org.mockito.Mockito.doAnswer(inv -> {
            var wrappedRes = (jakarta.servlet.http.HttpServletResponse) inv.getArgument(1);
            wrappedRes.setStatus(400);
            wrappedRes.getWriter().write("{\"error\":\"validation\"}");
            return null;
        }).when(chain).doFilter(any(), any());

        filter.doFilter(req, res, chain);

        assertThat(service.find("8:validation-fail-key")).isNull();
    }

    @Test
    @DisplayName("Farkli user'lar ayni key'i cakismadan kullanabilir")
    void differentUsers_isolated() throws Exception {
        service.store("1:shared-key", 200, "user1");
        service.store("2:shared-key", 200, "user2");

        authAs(1L);
        MockHttpServletRequest r1 = new MockHttpServletRequest("POST", "/api/applications");
        r1.addHeader(IdempotencyFilter.HEADER, "shared-key");
        MockHttpServletResponse res1 = new MockHttpServletResponse();
        filter.doFilter(r1, res1, chain);
        assertThat(res1.getContentAsString()).isEqualTo("user1");
    }
}
