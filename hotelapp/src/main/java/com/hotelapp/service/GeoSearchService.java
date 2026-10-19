package com.hotelapp.service;

import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ServiceUnavailableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Adres arama (geocode) — tarayıcı yerine sunucudan Nominatim (OpenStreetMap).
 *
 * <p>Nominatim kullanım koşulları: tanıtıcı User-Agent + iletişim e-postası, saniyede
 * en fazla 1 istek, otomatik tamamlama YOK (yalnız kullanıcı "ara" dediğinde), sonuç
 * önbelleği. Burada:
 * <ul>
 *   <li>Sorgu normalize edilir (trim, tek boşluk, Türkçe küçük harf); 3 karakterden kısa
 *       ya da 200'den uzun sorgu 422.</li>
 *   <li>Sonuçlar bellekte 24 saat tutulur (önbellekten dönen sorgu Nominatim'e gitmez).</li>
 *   <li>Önbellekte olmayan sorgular için tüm uygulamada saniyede en fazla 1 istek; sınır
 *       doluysa 503 + Türkçe mesaj (bekletmez, iş parçacığı tutmaz).</li>
 *   <li>Yalnız Türkiye ({@code countrycodes=tr}), en fazla 5 sonuç.</li>
 *   <li>Zaman aşımı ortak HTTP ayarlarından ({@code app.http.*}); ağ/sağlayıcı hatası 503.</li>
 * </ul>
 * Tek örnek (instance) varsayımı: çok örnekte sınır örnek başınadır.
 */
@Service
@Slf4j
public class GeoSearchService {

    public record GeoResult(double lat, double lon, String displayName) {}

    static final int MIN_QUERY = 3;
    static final int MAX_QUERY = 200;
    static final int MAX_RESULTS = 5;
    static final Duration CACHE_TTL = Duration.ofHours(24);
    static final Duration MIN_INTERVAL = Duration.ofSeconds(1);
    static final int MAX_CACHE_ENTRIES = 2_000;

    static final String MSG_TOO_SHORT = "Aramak için en az 3 karakter yaz.";
    static final String MSG_TOO_LONG = "Arama metni çok uzun.";
    static final String MSG_BUSY = "Adres araması şu an yoğun. Birkaç saniye sonra tekrar dene.";
    static final String MSG_UNAVAILABLE = "Adres araması şu anda yapılamıyor. Biraz sonra tekrar dene.";

    private static final Locale TR = Locale.forLanguageTag("tr");

    private record CacheEntry(List<GeoResult> results, Instant expiresAt) {}

    private final RestTemplate restTemplate;
    private final String nominatimUrl;
    private final String contactEmail;
    private final String userAgent;
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    Clock clock = Clock.systemUTC();
    private Instant lastUpstreamCall = Instant.EPOCH;

    @org.springframework.beans.factory.annotation.Autowired
    public GeoSearchService(
            @Value("${app.geo.nominatim-url:https://nominatim.openstreetmap.org/search}") String nominatimUrl,
            @Value("${app.geo.contact-email:}") String contactEmail,
            @Value("${app.base-url:http://localhost:5173}") String baseUrl,
            @Value("${app.http.connect-timeout-ms:5000}") int connectTimeoutMs,
            @Value("${app.http.read-timeout-ms:10000}") int readTimeoutMs) {
        this(new RestTemplate(com.hotelapp.config.AsyncConfig.httpRequestFactory(connectTimeoutMs, readTimeoutMs)),
                nominatimUrl, contactEmail, baseUrl);
    }

    GeoSearchService(RestTemplate restTemplate, String nominatimUrl, String contactEmail, String baseUrl) {
        this.restTemplate = restTemplate;
        this.nominatimUrl = nominatimUrl;
        this.contactEmail = contactEmail == null ? "" : contactEmail.trim();
        this.userAgent = "Kadrom/1.0 (+" + baseUrl + (this.contactEmail.isEmpty() ? "" : "; " + this.contactEmail) + ")";
    }

    /** Sorguyu normalize eder; geçersizse 422. */
    static String normalize(String q) {
        String n = q == null ? "" : q.trim().replaceAll("\\s+", " ").toLowerCase(TR);
        if (n.length() < MIN_QUERY) throw new BusinessRuleException(MSG_TOO_SHORT);
        if (n.length() > MAX_QUERY) throw new BusinessRuleException(MSG_TOO_LONG);
        return n;
    }

    public List<GeoResult> search(String rawQuery) {
        String q = normalize(rawQuery);
        Instant now = clock.instant();
        CacheEntry hit = cache.get(q);
        if (hit != null && now.isBefore(hit.expiresAt())) return hit.results();

        if (!tryAcquireUpstreamSlot(now)) {
            throw new ServiceUnavailableException(MSG_BUSY);
        }
        List<GeoResult> results = fetch(q);
        putCache(q, results, now);
        return results;
    }

    /** Uygulama genelinde saniyede en fazla 1 Nominatim isteği. */
    synchronized boolean tryAcquireUpstreamSlot(Instant now) {
        if (Duration.between(lastUpstreamCall, now).compareTo(MIN_INTERVAL) < 0) return false;
        lastUpstreamCall = now;
        return true;
    }

    private List<GeoResult> fetch(String q) {
        UriComponentsBuilder b = UriComponentsBuilder.fromHttpUrl(nominatimUrl)
                .queryParam("q", q)
                .queryParam("format", "jsonv2")
                .queryParam("countrycodes", "tr")
                .queryParam("limit", MAX_RESULTS)
                .queryParam("accept-language", "tr");
        if (!contactEmail.isEmpty()) b.queryParam("email", contactEmail);
        URI uri = b.encode().build().toUri();

        HttpHeaders headers = new HttpHeaders();
        headers.set(HttpHeaders.USER_AGENT, userAgent);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        try {
            List<Map<String, Object>> body = restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers),
                    new ParameterizedTypeReference<List<Map<String, Object>>>() {}).getBody();
            List<GeoResult> out = new ArrayList<>();
            if (body != null) {
                for (Map<String, Object> m : body) {
                    if (out.size() >= MAX_RESULTS) break;
                    GeoResult r = toResult(m);
                    if (r != null) out.add(r);
                }
            }
            return List.copyOf(out);
        } catch (RestClientException ex) {
            // Sorgu metni loglanmaz (kişisel adres olabilir)
            log.warn("[GEO] Nominatim istegi basarisiz: {}", ex.getClass().getSimpleName());
            throw new ServiceUnavailableException(MSG_UNAVAILABLE);
        }
    }

    private static GeoResult toResult(Map<String, Object> m) {
        try {
            Object lat = m.get("lat");
            Object lon = m.get("lon");
            Object name = m.get("display_name");
            if (lat == null || lon == null || name == null) return null;
            double la = Double.parseDouble(lat.toString());
            double lo = Double.parseDouble(lon.toString());
            if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
            return new GeoResult(la, lo, name.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private void putCache(String q, List<GeoResult> results, Instant now) {
        if (cache.size() >= MAX_CACHE_ENTRIES) {
            cache.entrySet().removeIf(e -> !now.isBefore(e.getValue().expiresAt()));
            if (cache.size() >= MAX_CACHE_ENTRIES) cache.clear();
        }
        cache.put(q, new CacheEntry(results, now.plus(CACHE_TTL)));
    }
}
