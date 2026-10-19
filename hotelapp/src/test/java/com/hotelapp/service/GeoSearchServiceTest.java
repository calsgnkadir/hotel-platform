package com.hotelapp.service;

import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ServiceUnavailableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** Adres arama: Nominatim'e gerçek çağrı yok (MockRestServiceServer). */
class GeoSearchServiceTest {

    private static final String URL = "https://nominatim.test/search";
    private static final String BODY = """
            [{"lat":"41.0369","lon":"28.9850","display_name":"Taksim, Beyoğlu, İstanbul"},
             {"lat":"bozuk","lon":"28.9","display_name":"Bozuk kayıt"},
             {"lat":"41.04","lon":"28.98","display_name":"İkinci"}]
            """;

    private RestTemplate rest;
    private MockRestServiceServer server;
    private GeoSearchService service;
    private Instant now = Instant.parse("2026-10-18T10:00:00Z");

    @BeforeEach
    void setUp() {
        rest = new RestTemplate();
        server = MockRestServiceServer.bindTo(rest).build();
        service = new GeoSearchService(rest, URL, "destek@kadrom.test", "https://kadrom.test");
        setClock(now);
    }

    private void setClock(Instant t) {
        service.clock = Clock.fixed(t, ZoneOffset.UTC);
    }

    @Test
    @DisplayName("Nominatim: Türkiye, en fazla 5, tanıtıcı User-Agent + e-posta; bozuk kayıt atlanır")
    void search_mapsResults() {
        server.expect(requestTo(org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.startsWith(URL + "?q="),
                        org.hamcrest.Matchers.containsString("countrycodes=tr"),
                        org.hamcrest.Matchers.containsString("limit=5"),
                        org.hamcrest.Matchers.containsString("format=jsonv2"),
                        org.hamcrest.Matchers.containsString("email=destek@kadrom.test"))))
                .andExpect(method(HttpMethod.GET))
                .andExpect(header(HttpHeaders.USER_AGENT, org.hamcrest.Matchers.startsWith("Kadrom/1.0 (+https://kadrom.test; destek@kadrom.test")))
                .andRespond(withSuccess(BODY, MediaType.APPLICATION_JSON));

        var results = service.search("  Taksim   Meydanı ");

        assertThat(results).hasSize(2);
        assertThat(results.get(0).lat()).isEqualTo(41.0369);
        assertThat(results.get(0).lon()).isEqualTo(28.985);
        assertThat(results.get(0).displayName()).isEqualTo("Taksim, Beyoğlu, İstanbul");
        server.verify();
    }

    @Test
    @DisplayName("Aynı (normalize) sorgu 24 saat önbellekten; süre dolunca yeniden sorulur")
    void cache_24h() {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(URL)))
                .andRespond(withSuccess(BODY, MediaType.APPLICATION_JSON));
        service.search("Kadıköy");
        setClock(now.plusSeconds(5));
        assertThat(service.search("  KADIKÖY ")).hasSize(2);   // Nominatim'e gitmedi
        server.verify();

        server.reset();
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(URL)))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        setClock(now.plus(24, ChronoUnit.HOURS).plusSeconds(1));
        assertThat(service.search("kadıköy")).isEmpty();
        server.verify();
    }

    @Test
    @DisplayName("Saniyede en fazla 1 Nominatim isteği (global): ikinci farklı sorgu 503 + Türkçe mesaj")
    void rateLimit_globalOnePerSecond() {
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(URL)))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        service.search("beşiktaş");
        setClock(now.plusMillis(500));
        assertThatThrownBy(() -> service.search("şişli"))
                .isInstanceOf(ServiceUnavailableException.class)
                .hasMessage("Adres araması şu an yoğun. Birkaç saniye sonra tekrar dene.");
        server.verify();

        server.reset();
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(URL)))
                .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));
        setClock(now.plusMillis(1000));
        assertThat(service.search("şişli")).isEmpty();
        server.verify();
    }

    @Test
    @DisplayName("Kısa/uzun sorgu 422; sağlayıcı hatası 503 ve önbelleğe yazılmaz")
    void validationAndUpstreamError() {
        assertThatThrownBy(() -> service.search(" ab "))
                .isInstanceOf(BusinessRuleException.class).hasMessage("Aramak için en az 3 karakter yaz.");
        assertThatThrownBy(() -> service.search(null)).isInstanceOf(BusinessRuleException.class);
        assertThatThrownBy(() -> service.search("x".repeat(201))).isInstanceOf(BusinessRuleException.class);

        server.expect(requestTo(org.hamcrest.Matchers.startsWith(URL))).andRespond(withServerError());
        assertThatThrownBy(() -> service.search("üsküdar"))
                .isInstanceOf(ServiceUnavailableException.class)
                .hasMessage("Adres araması şu anda yapılamıyor. Biraz sonra tekrar dene.");
        server.verify();

        server.reset();
        server.expect(requestTo(org.hamcrest.Matchers.startsWith(URL)))
                .andRespond(withSuccess(BODY, MediaType.APPLICATION_JSON));
        setClock(now.plusSeconds(2));
        assertThat(service.search("üsküdar")).hasSize(2);   // hata önbelleğe yazılmamıştı
        server.verify();
    }
}
