package com.hotelapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.entity.User;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.PaymentMethod;
import com.hotelapp.enums.PaymentPeriod;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import com.hotelapp.enums.Shift;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.service.JobListingService.ListingRequest;
import com.hotelapp.service.JobListingService.ShiftSlotCreate;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Guvenlik paketi uctan uca:
 *  - Actuator: health ozeti herkese, detay ve metrik/prometheus yalniz ADMIN
 *  - Banli / devre disi kullanici refresh ile yeni oturum alamaz
 *  - Admin'in askiya aldigi ilani isletme yayina alamaz; admin aktif edince kalkar
 */
@SpringBootTest
@AutoConfigureMockMvc
// Test ortaminda metrik ihracati (prometheus) varsayilan kapali; yetki testi icin ac
@org.springframework.boot.micrometer.metrics.test.autoconfigure.AutoConfigureMetrics(export = true)
@ActiveProfiles("test")
class SecurityHardeningIT {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository userRepository;

    // ---------------- Adres arama / KVKK onayı (HTTP) ----------------

    @Test
    @DisplayName("Adres arama yalnız girişli kullanıcıya; kısa sorgu 422 (dış çağrı yapılmaz)")
    void geoSearch_requiresAuth_andRejectsShortQuery() throws Exception {
        mvc.perform(get("/api/geo/search").param("q", "taksim"))
                .andExpect(status().isUnauthorized());
        Auth cand = register(candidate("cand.geo@test.com"));
        mvc.perform(get("/api/geo/search").param("q", "ab").header("Authorization", "Bearer " + cand.token))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Aramak için en az 3 karakter yaz."));
    }

    @Test
    @DisplayName("Kayıt: Kullanım Şartları kabul edilmeden 422, hesap oluşmaz")
    void register_withoutTerms_422() throws Exception {
        RegisterRequest r = candidate("no.terms@test.com");
        r.setTermsAccepted(false);
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(r)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Kullanım Şartları kabul edilmeli."));
        assertThat(userRepository.findByEmail("no.terms@test.com")).isEmpty();
    }

    // ---------------- Actuator ----------------

    @Test
    @DisplayName("Actuator: /health ozeti public (detaysiz); prometheus/detay yalniz ADMIN")
    void actuator_onlyAdminSeesDetailsAndMetrics() throws Exception {
        String anonHealth = mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").exists())
                .andReturn().getResponse().getContentAsString();
        assertThat(anonHealth).doesNotContain("components").doesNotContain("details");

        int anonProm = mvc.perform(get("/actuator/prometheus")).andReturn().getResponse().getStatus();
        assertThat(anonProm).isGreaterThanOrEqualTo(300);

        Auth cand = register(candidate("cand.act@test.com"));
        mvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer " + cand.token))
                .andExpect(status().isForbidden());
        String candHealth = mvc.perform(get("/actuator/health").header("Authorization", "Bearer " + cand.token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(candHealth).doesNotContain("components");

        Auth admin = registerAdmin("admin.act@test.com");
        mvc.perform(get("/actuator/prometheus").header("Authorization", "Bearer " + admin.token))
                .andExpect(status().isOk());
        mvc.perform(get("/actuator/health").header("Authorization", "Bearer " + admin.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components").exists());
    }

    // ---------------- Refresh / ban ----------------

    @Test
    @DisplayName("Admin ban'i: refresh token iptal, yeni oturum alinamaz")
    void bannedViaAdmin_cannotRefresh() throws Exception {
        Auth admin = registerAdmin("admin.ban@test.com");
        Auth cand = register(candidate("cand.ban1@test.com"));

        mvc.perform(put("/api/admin/users/" + cand.userId + "/ban")
                        .header("Authorization", "Bearer " + admin.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"days\":3}"))
                .andExpect(status().isOk());

        MvcResult r = mvc.perform(post("/api/auth/refresh").cookie(new Cookie("refreshToken", cand.refresh)))
                .andReturn();
        assertThat(r.getResponse().getStatus()).isBetween(400, 499);
        assertThat(r.getResponse().getContentAsString()).doesNotContain("\"token\"");
    }

    @Test
    @DisplayName("Ban/devre disi kaydi token iptalini kacirsa bile refresh reddedilir (ikinci katman)")
    void bannedOrDisabled_directlyInDb_cannotRefresh() throws Exception {
        Auth banned = register(candidate("cand.ban2@test.com"));
        User u = userRepository.findById(banned.userId).orElseThrow();
        u.setBannedUntil(LocalDateTime.now().plusDays(1));
        userRepository.save(u);
        MvcResult r1 = mvc.perform(post("/api/auth/refresh").cookie(new Cookie("refreshToken", banned.refresh)))
                .andReturn();
        assertThat(r1.getResponse().getStatus()).isBetween(400, 499);

        Auth disabled = register(candidate("cand.del@test.com"));
        User d = userRepository.findById(disabled.userId).orElseThrow();
        d.setEnabled(false);
        userRepository.save(d);
        MvcResult r2 = mvc.perform(post("/api/auth/refresh").cookie(new Cookie("refreshToken", disabled.refresh)))
                .andReturn();
        assertThat(r2.getResponse().getStatus()).isBetween(400, 499);

        // Kontrol: normal kullanici refresh alir
        Auth ok = register(candidate("cand.ok@test.com"));
        mvc.perform(post("/api/auth/refresh").cookie(new Cookie("refreshToken", ok.refresh)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists());
    }

    // ---------------- Admin askisi ----------------

    @Test
    @DisplayName("Admin askisindaki ilan isletmece ACTIVE yapilamaz (422); admin aktif edince serbest")
    void adminSuspendedListing_ownerCannotActivate() throws Exception {
        Auth admin = registerAdmin("admin.lst@test.com");
        Auth biz = register(business("biz.lst@test.com"));
        long listingId = createListing(biz.token);

        mvc.perform(put("/api/admin/listings/" + listingId + "/status")
                        .header("Authorization", "Bearer " + admin.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PAUSED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.adminSuspended").value(true));

        mvc.perform(put("/api/listings/" + listingId + "/status").param("status", "ACTIVE")
                        .header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("askıya alındı")));

        mvc.perform(put("/api/admin/listings/" + listingId + "/status")
                        .header("Authorization", "Bearer " + admin.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"ACTIVE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.adminSuspended").value(false));

        mvc.perform(put("/api/listings/" + listingId + "/status").param("status", "PAUSED")
                        .header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isOk());
        mvc.perform(put("/api/listings/" + listingId + "/status").param("status", "ACTIVE")
                        .header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.adminSuspended").value(false));
    }

    // ---------------- Helpers ----------------

    record Auth(Long userId, String token, String refresh) {}

    private Auth register(RegisterRequest req) throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode node = json.readTree(r.getResponse().getContentAsString());
        Cookie c = r.getResponse().getCookie("refreshToken");
        return new Auth(node.get("userId").asLong(), node.get("token").asText(), c != null ? c.getValue() : null);
    }

    /** Kayit + rolu veritabaninda ADMIN'e cevir (JwtAuthFilter rolu DB'den okur). */
    private Auth registerAdmin(String email) throws Exception {
        Auth a = register(candidate(email));
        User u = userRepository.findById(a.userId()).orElseThrow();
        u.setRole(Role.ADMIN);
        userRepository.save(u);
        return a;
    }

    private long createListing(String bizToken) throws Exception {
        ShiftSlotCreate s = new ShiftSlotCreate();
        s.setDate(LocalDate.now().plusDays(7));
        s.setStartTime(LocalTime.of(9, 0));
        s.setEndTime(LocalTime.of(17, 0));
        s.setSlotsNeeded(2);
        ListingRequest req = new ListingRequest();
        req.setPosition(Position.WAITER);
        req.setJobType(JobType.PART_TIME);
        req.setShift(Shift.MORNING);
        req.setTitle("Test Garson");
        req.setDescription("Test description");
        req.setDressCode("Siyah pantolon, beyaz gomlek");
        req.setPaymentPeriod(PaymentPeriod.SAME_DAY);
        req.setPaymentMethod(PaymentMethod.CASH);
        req.setShiftSlots(List.of(s));
        String resp = mvc.perform(post("/api/listings")
                        .header("Authorization", "Bearer " + bizToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().is2xxSuccessful())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(resp).get("id").asLong();
    }

    private RegisterRequest candidate(String email) {
        RegisterRequest r = new RegisterRequest();
        r.setTermsAccepted(true);              // KVKK onayi (V27)
        r.setPrivacyNoticeVersion("2026-10-17");
        r.setFullName("Aday Test");
        r.setEmail(email);
        r.setPassword("Test1234");
        r.setRole(Role.CANDIDATE);
        r.setPhone("0555 111 22 33");
        return r;
    }

    private RegisterRequest business(String email) {
        RegisterRequest r = new RegisterRequest();
        r.setTermsAccepted(true);              // KVKK onayi (V27)
        r.setPrivacyNoticeVersion("2026-10-17");
        r.setFullName("Biz Test");
        r.setEmail(email);
        r.setPassword("Test1234");
        r.setRole(Role.BUSINESS_OWNER);
        r.setPhone("0555 444 33 22");
        r.setBusinessName("Test Otel");
        r.setBusinessType(BusinessType.HOTEL);
        r.setDistrict("Sisli");
        r.setBusinessPhone("0212 999 88 77");
        return r;
    }
}
