package com.hotelapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.dto.ApplicationRequest;
import com.hotelapp.dto.MessageRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.enums.*;
import com.hotelapp.service.JobListingService.ListingRequest;
import com.hotelapp.service.JobListingService.ShiftSlotCreate;
import lombok.AllArgsConstructor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Isletme adayi engeller — uctan uca:
 * basvuru -> engel (aktif basvuru REJECTED) -> liste e-postasiz -> aday basvuramaz (422)
 * -> aday mesaj atamaz (403) -> isletme engelliye yazamaz (422) -> engel kalkar -> normal.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CandidateBlockFlowIT {

    private static final String BLOCKED = "/api/business/blocked-candidates";

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    @Test
    void business_blocks_candidate_then_unblocks() throws Exception {
        Auth biz = register(business("biz.block1@test.com"));
        Auth cand = register(candidate("cand.block1@test.com"));
        Long listingId = createListing(biz.token);
        Long slotId = fetchFirstSlotId(listingId, cand.token);

        // 1) Aday basvurur -> PENDING + otomatik sohbet
        String applyResp = apply(cand.token, listingId, slotId)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn().getResponse().getContentAsString();
        JsonNode applied = json.readTree(applyResp);
        long applicationId = applied.get("id").asLong();
        long convId = applied.get("conversationId").asLong();

        // 2) Isletme engeller -> 204; tekrar -> 204 (idempotent)
        mvc.perform(post(BLOCKED + "/" + cand.userId).header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isNoContent());
        mvc.perform(post(BLOCKED + "/" + cand.userId).header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isNoContent());

        // 3) Liste: aday var, e-posta/telefon yok
        mvc.perform(get(BLOCKED).header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].candidateId").value(cand.userId))
                .andExpect(jsonPath("$[0].candidateName").value("Aday Test"))
                .andExpect(jsonPath("$[0].blockedAt").exists())
                .andExpect(jsonPath("$[0].candidateEmail").doesNotExist())
                .andExpect(jsonPath("$[0].email").doesNotExist())
                .andExpect(jsonPath("$[0].phone").doesNotExist());

        // 4) Aktif basvuru REJECTED oldu
        mvc.perform(get("/api/candidate/applications").header("Authorization", "Bearer " + cand.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id == " + applicationId + ")].status").value("REJECTED"));

        // 5) Aday tekrar basvuramaz -> 422
        apply(cand.token, listingId, slotId)
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Bu işletmeye başvuru yapamazsın."));

        // 6) Aday mesaj atamaz -> 403
        mvc.perform(post("/api/messages/conversations/" + convId + "/messages")
                        .header("Authorization", "Bearer " + cand.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(text("merhaba"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Bu işletmeyle iletişim kapalı."));

        // 7) Isletme engelledigi adaya yazamaz -> 422
        mvc.perform(post("/api/messages/conversations/" + convId + "/messages")
                        .header("Authorization", "Bearer " + biz.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(text("selam"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("Önce engeli kaldır."));

        // 8) Ilan detayi adaya gorunmeye devam eder
        mvc.perform(get("/api/listings/" + listingId).header("Authorization", "Bearer " + cand.token))
                .andExpect(status().isOk());

        // 9) Engel kalkar -> 204; tekrar -> 204 (idempotent); liste bos
        mvc.perform(delete(BLOCKED + "/" + cand.userId).header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isNoContent());
        mvc.perform(delete(BLOCKED + "/" + cand.userId).header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isNoContent());
        mvc.perform(get(BLOCKED).header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // 10) Normal akis geri gelir
        apply(cand.token, listingId, slotId).andExpect(status().isCreated());
        mvc.perform(post("/api/messages/conversations/" + convId + "/messages")
                        .header("Authorization", "Bearer " + cand.token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(text("tekrar merhaba"))))
                .andExpect(status().isCreated());
    }

    @Test
    void cannot_block_candidate_without_relation_or_as_candidate() throws Exception {
        Auth biz = register(business("biz.block2@test.com"));
        Auth cand = register(candidate("cand.block2@test.com"));

        // Basvuru iliskisi yok -> 404
        mvc.perform(post(BLOCKED + "/" + cand.userId).header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isNotFound());
        // Olmayan kullanici -> ayni 404
        mvc.perform(post(BLOCKED + "/999999").header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isNotFound());
        mvc.perform(get(BLOCKED).header("Authorization", "Bearer " + biz.token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // Aday rolu bu uclari kullanamaz -> 403
        mvc.perform(post(BLOCKED + "/" + biz.userId).header("Authorization", "Bearer " + cand.token))
                .andExpect(status().isForbidden());
        mvc.perform(get(BLOCKED).header("Authorization", "Bearer " + cand.token))
                .andExpect(status().isForbidden());
    }

    /* ─────────────────── Helpers ─────────────────── */

    @AllArgsConstructor
    static class Auth {
        Long userId;
        String token;
    }

    private org.springframework.test.web.servlet.ResultActions apply(String token, Long listingId, Long slotId)
            throws Exception {
        ApplicationRequest req = new ApplicationRequest();
        req.setJobListingId(listingId);
        req.setSlotIds(List.of(slotId));
        return mvc.perform(post("/api/candidate/applications")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)));
    }

    private static MessageRequest text(String content) {
        MessageRequest m = new MessageRequest();
        m.setContent(content);
        return m;
    }

    private Auth register(RegisterRequest req) throws Exception {
        String body = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = json.readTree(body);
        return new Auth(node.get("userId").asLong(), node.get("token").asText());
    }

    private Long createListing(String bizToken) throws Exception {
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

    private Long fetchFirstSlotId(Long listingId, String token) throws Exception {
        String resp = mvc.perform(get("/api/listings/" + listingId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(resp).get("shiftSlots").get(0).get("id").asLong();
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
        r.setPhone("0555 444 33 22");
        r.setBusinessName("Test Otel");
        r.setBusinessType(BusinessType.HOTEL);
        r.setDistrict("Sisli");
        r.setBusinessPhone("0212 999 88 77");
        return r;
    }
}
