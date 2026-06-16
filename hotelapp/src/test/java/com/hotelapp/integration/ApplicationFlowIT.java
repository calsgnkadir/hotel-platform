package com.hotelapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.dto.ApplicationRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.enums.*;
import com.hotelapp.service.JobListingService.ListingRequest;
import com.hotelapp.service.JobListingService.ShiftSlotCreate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * FAZ 0/#4b — Ilan olustur + aday apply + duplicate guard.
 *
 * Senaryolar:
 *  1) Business kayit + ilan olustur (slot ile) -> 200 + id
 *  2) Candidate kayit + apply -> 200 PENDING + slot tutuldu
 *  3) Ayni candidate ayni ilana 2. kez apply -> 4xx (duplicate)
 *  4) Business owner kendi ilanina apply edemez (rol kontrolu) -> 403
 *  5) Olmayan ilan ID -> 4xx
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApplicationFlowIT {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    @Test
    void candidate_can_apply_to_listing_and_duplicate_is_rejected() throws Exception {
        // 1) Business kayit + token
        String bizToken = registerAndGetToken(business("biz1@app.com"));

        // 2) Ilan olustur (1 slot)
        Long listingId = createListing(bizToken, slot(LocalDate.now().plusDays(7), "09:00", "17:00", 2));

        // 3) Candidate kayit + token
        String candToken = registerAndGetToken(candidate("aday1@app.com"));

        // 4) Listing detayini cek, slot id'sini al (candidate token ile)
        Long slotId = fetchFirstSlotId(listingId, candToken);

        // 5) Apply -> basarili
        ApplicationRequest apply = new ApplicationRequest();
        apply.setJobListingId(listingId);
        apply.setCoverLetter("Cok motiveyim.");
        apply.setSlotIds(List.of(slotId));

        mvc.perform(post("/api/candidate/applications")
                .header("Authorization", "Bearer " + candToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(apply)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.listing.id").value(listingId));

        // 6) Ayni candidate ayni ilana 2. kez apply -> reddedilmeli
        mvc.perform(post("/api/candidate/applications")
                .header("Authorization", "Bearer " + candToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(apply)))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void business_owner_cannot_apply_role_check() throws Exception {
        // Business kayit
        String bizToken = registerAndGetToken(business("biz2@app.com"));
        Long listingId = createListing(bizToken, slot(LocalDate.now().plusDays(5), "10:00", "18:00", 1));
        Long slotId = fetchFirstSlotId(listingId, bizToken);

        ApplicationRequest apply = new ApplicationRequest();
        apply.setJobListingId(listingId);
        apply.setSlotIds(List.of(slotId));

        // Business token ile candidate endpoint'ine vurursa 403 olur
        mvc.perform(post("/api/candidate/applications")
                .header("Authorization", "Bearer " + bizToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(apply)))
            .andExpect(status().isForbidden());
    }

    @Test
    void apply_to_nonexistent_listing_fails() throws Exception {
        String candToken = registerAndGetToken(candidate("aday2@app.com"));

        ApplicationRequest apply = new ApplicationRequest();
        apply.setJobListingId(999999L);
        apply.setSlotIds(List.of(1L));

        mvc.perform(post("/api/candidate/applications")
                .header("Authorization", "Bearer " + candToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(apply)))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void apply_without_slot_fails() throws Exception {
        String bizToken = registerAndGetToken(business("biz3@app.com"));
        Long listingId = createListing(bizToken, slot(LocalDate.now().plusDays(3), "08:00", "16:00", 1));

        String candToken = registerAndGetToken(candidate("aday3@app.com"));

        ApplicationRequest apply = new ApplicationRequest();
        apply.setJobListingId(listingId);
        // slotIds VERMIYORUZ - validation hata vermeli

        mvc.perform(post("/api/candidate/applications")
                .header("Authorization", "Bearer " + candToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(apply)))
            .andExpect(status().is4xxClientError());
    }

    /* ─────────────────── Helpers ─────────────────── */

    private String registerAndGetToken(RegisterRequest req) throws Exception {
        String body = mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("token").asText();
    }

    private Long createListing(String bizToken, ShiftSlotCreate... slots) throws Exception {
        ListingRequest req = new ListingRequest();
        req.setPosition(Position.WAITER);
        req.setJobType(JobType.PART_TIME);
        req.setShift(Shift.MORNING);
        req.setTitle("Test Garson");
        req.setDescription("Test description");
        req.setShiftSlots(List.of(slots));

        String resp = mvc.perform(post("/api/listings")
                .header("Authorization", "Bearer " + bizToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().is2xxSuccessful())
            .andReturn().getResponse().getContentAsString();
        return json.readTree(resp).get("id").asLong();
    }

    private Long fetchFirstSlotId(Long listingId, String token) throws Exception {
        String resp = mvc.perform(get("/api/listings/" + listingId)
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        JsonNode root = json.readTree(resp);
        JsonNode slots = root.get("shiftSlots");
        if (slots == null || !slots.isArray() || slots.isEmpty()) {
            throw new IllegalStateException("Listing " + listingId + " has no slots in response");
        }
        return slots.get(0).get("id").asLong();
    }

    private ShiftSlotCreate slot(LocalDate date, String start, String end, int needed) {
        ShiftSlotCreate s = new ShiftSlotCreate();
        s.setDate(date);
        s.setStartTime(LocalTime.parse(start));
        s.setEndTime(LocalTime.parse(end));
        s.setSlotsNeeded(needed);
        return s;
    }

    private RegisterRequest candidate(String email) {
        RegisterRequest r = new RegisterRequest();
        r.setFullName("Aday Test");
        r.setEmail(email);
        r.setPassword("Test1234");
        r.setRole(Role.CANDIDATE);
        r.setPhone("0555 111 22 33");
        return r;
    }

    private RegisterRequest business(String email) {
        RegisterRequest r = new RegisterRequest();
        r.setFullName("Biz Test");
        r.setEmail(email);
        r.setPassword("Test1234");
        r.setRole(Role.BUSINESS_OWNER);
        r.setPhone("0555 222 33 44");
        r.setBusinessName("Test Otel");
        r.setBusinessType(BusinessType.HOTEL);
        r.setDistrict("Beyoglu");
        r.setBusinessPhone("0212 555 12 34");
        return r;
    }
}
