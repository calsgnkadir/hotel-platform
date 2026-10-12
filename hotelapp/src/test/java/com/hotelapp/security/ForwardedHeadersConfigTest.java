package com.hotelapp.security;

import org.apache.catalina.connector.Connector;
import org.apache.catalina.connector.Request;
import org.apache.catalina.connector.Response;
import org.apache.catalina.valves.RemoteIpValve;
import org.apache.catalina.valves.ValveBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * XFF guveni tek yerde: prod'da Tomcat RemoteIpValve ('native'). 'framework'
 * (ForwardedHeaderFilter) XFF'in en solunu remoteAddr yapiyordu → sahte XFF ile
 * IP kovasi atlatiliyordu. Bu test hem prod ayarini hem valve'in (varsayilan
 * internal-proxies ile) beklenen davranisini sabitler.
 */
class ForwardedHeadersConfigTest {

    @Test
    @DisplayName("application-prod.yml: forward-headers-strategy=native (framework degil)")
    void prodUsesNativeStrategy() throws Exception {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader()
                .load("prod", new ClassPathResource("application-prod.yml"));
        Object strategy = sources.stream()
                .map(s -> s.getProperty("server.forward-headers-strategy"))
                .filter(v -> v != null).findFirst().orElse(null);
        assertThat(String.valueOf(strategy)).isEqualTo("native");
    }

    private static String resolve(String peer, String xff) throws Exception {
        Request request = new Request(new Connector());
        request.setCoyoteRequest(new org.apache.coyote.Request());
        request.setRemoteAddr(peer);
        request.setRemoteHost(peer);
        if (xff != null) {
            request.getCoyoteRequest().getMimeHeaders().addValue("X-Forwarded-For").setString(xff);
        }
        AtomicReference<String> seen = new AtomicReference<>();
        RemoteIpValve valve = new RemoteIpValve();   // varsayilan internal-proxies (Spring Boot ile ayni)
        valve.setNext(new ValveBase() {
            @Override
            public void invoke(Request req, Response resp) {
                seen.set(req.getRemoteAddr());
            }
        });
        valve.invoke(request, new Response());
        return seen.get();
    }

    @Test
    @DisplayName("Ic ag proxy'si arkasinda: istemcinin soldan ekledigi sahte deger yok sayilir, proxy'nin ekledigi (sag) kullanilir")
    void behindInternalProxy_rightmostClientIpWins() throws Exception {
        assertThat(resolve("10.20.30.40", "6.6.6.6, 203.0.113.9")).isEqualTo("203.0.113.9");
        assertThat(resolve("10.20.30.40", "203.0.113.9")).isEqualTo("203.0.113.9");
    }

    @Test
    @DisplayName("Dogrudan (proxy'siz) gelen istekte XFF hic dikkate alinmaz")
    void directPublicPeer_xffIgnored() throws Exception {
        assertThat(resolve("198.51.100.20", "6.6.6.6")).isEqualTo("198.51.100.20");
    }
}
