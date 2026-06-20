package com.hotelapp.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

class CorrelationIdFilterTest {

    private CorrelationIdFilter filter;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        filter = new CorrelationIdFilter();
        chain = mock(FilterChain.class);
        MDC.clear();
    }

    @Test
    @DisplayName("Header yoksa: yeni UUID uretilir, response'a yazilir, MDC dolar")
    void noHeader_generatesAndSetsCid() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/listings");
        MockHttpServletResponse res = new MockHttpServletResponse();

        String[] cidDuringChain = new String[1];
        doAnswer(inv -> {
            cidDuringChain[0] = MDC.get(CorrelationIdFilter.MDC_KEY);
            return null;
        }).when(chain).doFilter(any(), any());

        filter.doFilter(req, res, chain);

        assertThat(cidDuringChain[0]).isNotNull().hasSize(12);  // shortUuid
        assertThat(res.getHeader(CorrelationIdFilter.HEADER)).isEqualTo(cidDuringChain[0]);
        assertThat(MDC.get(CorrelationIdFilter.MDC_KEY))
                .as("Filter cikiisinda MDC temizlenmeli")
                .isNull();
    }

    @Test
    @DisplayName("Header varsa: olduğu gibi kullanılır (upstream proxy zinciri)")
    void inboundHeader_preserved() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/listings");
        req.addHeader(CorrelationIdFilter.HEADER, "gateway-abc123");
        MockHttpServletResponse res = new MockHttpServletResponse();

        String[] cidDuringChain = new String[1];
        doAnswer(inv -> {
            cidDuringChain[0] = MDC.get(CorrelationIdFilter.MDC_KEY);
            return null;
        }).when(chain).doFilter(any(), any());

        filter.doFilter(req, res, chain);

        assertThat(cidDuringChain[0]).isEqualTo("gateway-abc123");
        assertThat(res.getHeader(CorrelationIdFilter.HEADER)).isEqualTo("gateway-abc123");
    }

    @Test
    @DisplayName("Header'da kotu karakter: sanitize edilir (injection guvenligi)")
    void inboundHeader_sanitized() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/listings");
        // Yeni satır + ANSI escape — log injection klasik vektörü
        req.addHeader(CorrelationIdFilter.HEADER, "bad\r\n[31mPWNED[0m");
        MockHttpServletResponse res = new MockHttpServletResponse();

        String[] cidDuringChain = new String[1];
        doAnswer(inv -> {
            cidDuringChain[0] = MDC.get(CorrelationIdFilter.MDC_KEY);
            return null;
        }).when(chain).doFilter(any(), any());

        filter.doFilter(req, res, chain);

        String cid = cidDuringChain[0];
        assertThat(cid).doesNotContain("\r", "\n", "", "[", "]");
        assertThat(cid).matches("[A-Za-z0-9_-]+");
    }

    @Test
    @DisplayName("Bos header: yeni UUID fallback")
    void blankHeader_fallsBack() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/listings");
        req.addHeader(CorrelationIdFilter.HEADER, "   ");
        MockHttpServletResponse res = new MockHttpServletResponse();

        String[] cidDuringChain = new String[1];
        doAnswer(inv -> {
            cidDuringChain[0] = MDC.get(CorrelationIdFilter.MDC_KEY);
            return null;
        }).when(chain).doFilter(any(), any());

        filter.doFilter(req, res, chain);

        assertThat(cidDuringChain[0]).hasSize(12);  // shortUuid fallback
    }
}
