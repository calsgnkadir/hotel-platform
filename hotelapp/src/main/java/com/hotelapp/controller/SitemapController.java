package com.hotelapp.controller;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.JobListingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicReference;

/**
 * FAZ 11.W4.3 — sitemap.xml + robots.txt (SEO).
 *
 * Aktif ilanlarin public URL'lerini + statik sayfalari listeler.
 * Google/Bing crawl edince ilan sayfalari organik trafige acilir.
 *
 * 10 dakikalik in-memory cache — sitemap istegi DB'yi dovmesin
 * (public endpoint, rate-limit'e ek koruma).
 */
@RestController
@RequiredArgsConstructor
public class SitemapController {

    private final JobListingRepository jobListingRepository;
    private final BusinessRepository businessRepository;

    /** Frontend base URL — prod'da Vercel domain'i (APP_BASE_URL env). */
    @Value("${app.base-url:http://localhost:5173}")
    private String baseUrl;

    private static final java.time.Duration CACHE_TTL = java.time.Duration.ofMinutes(10);
    private final AtomicReference<CachedSitemap> cache = new AtomicReference<>();

    private record CachedSitemap(String xml, LocalDateTime builtAt) {}

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public String sitemap() {
        CachedSitemap cached = cache.get();
        if (cached != null && cached.builtAt().plus(CACHE_TTL).isAfter(LocalDateTime.now())) {
            return cached.xml();
        }
        String xml = buildSitemap();
        cache.set(new CachedSitemap(xml, LocalDateTime.now()));
        return xml;
    }

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public String robots() {
        return """
               User-agent: *
               Allow: /
               Disallow: /candidate
               Disallow: /business
               Disallow: /admin
               Disallow: /login
               Disallow: /register

               Sitemap: %s/sitemap.xml
               """.formatted(baseUrl);
    }

    private String buildSitemap() {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        DateTimeFormatter fmt = DateTimeFormatter.ISO_LOCAL_DATE;
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        // Statik public sayfalar
        appendUrl(sb, base + "/",         "daily",   "1.0", null, fmt);
        appendUrl(sb, base + "/register", "monthly", "0.8", null, fmt);
        appendUrl(sb, base + "/yardim",   "monthly", "0.3", null, fmt);
        appendUrl(sb, base + "/kvkk",     "yearly",  "0.1", null, fmt);

        // Aktif ilan detaylari — public paylasillabilir URL'ler
        for (JobListing l : jobListingRepository.findAll()) {
            if (l.getStatus() != ListingStatus.ACTIVE) continue;
            appendUrl(sb, base + "/listings/" + l.getId(), "daily", "0.9", l.getCreatedAt(), fmt);
        }

        // FAZ 14.3 — Isletme public profilleri (login gerektirmez, paylasilir).
        // Aday profilleri PII + auth'lu — sitemap'e GIRMEZ.
        for (Business b : businessRepository.findAll()) {
            appendUrl(sb, base + "/p/business/" + b.getId(), "weekly", "0.7", b.getCreatedAt(), fmt);
        }

        sb.append("</urlset>\n");
        return sb.toString();
    }

    private void appendUrl(StringBuilder sb, String loc, String changefreq, String priority,
                           LocalDateTime lastmod, DateTimeFormatter fmt) {
        sb.append("  <url>\n");
        sb.append("    <loc>").append(loc).append("</loc>\n");
        if (lastmod != null) {
            sb.append("    <lastmod>").append(lastmod.format(fmt)).append("</lastmod>\n");
        }
        sb.append("    <changefreq>").append(changefreq).append("</changefreq>\n");
        sb.append("    <priority>").append(priority).append("</priority>\n");
        sb.append("  </url>\n");
    }
}
