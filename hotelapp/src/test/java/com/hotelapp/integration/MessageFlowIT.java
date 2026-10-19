package com.hotelapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.dto.ApplicationRequest;
import com.hotelapp.dto.MessageRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.dto.StartConversationRequest;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.JobType;
import com.hotelapp.enums.PaymentMethod;
import com.hotelapp.enums.PaymentPeriod;
import com.hotelapp.enums.Position;
import com.hotelapp.enums.Role;
import com.hotelapp.enums.Shift;
import com.hotelapp.service.JobListingService.ListingRequest;
import com.hotelapp.service.JobListingService.ShiftSlotCreate;
import lombok.AllArgsConstructor;
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
 * FAZ 0/#4c — Sohbet ac + mesaj gonder + okundu + unread sayisi.
 *
 * Senaryolar:
 *  1) Iki kullanici sohbet acabilir + idempotent (ayni cift, ayni sohbet doner)
 *  2) Mesaj gonder -> 201 + content donen DTO'da
 *  3) Karsi tarafin unread count'u 1 olur
 *  4) Mark read sonrasi unread count 0
 *  5) Sohbete dahil olmayan 3. kullanici mesajlari goremez (403/404)
 *  6) Bos mesaj reddedilir (400)
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MessageFlowIT {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;

    @Test
    void start_conversation_send_message_mark_read() throws Exception {
        // Iki kullanici kaydet
        Auth biz  = registerAndGetAuth(business("biz.msg1@test.com"));
        Auth cand = registerAndGetAuth(candidate("cand.msg1@test.com"));
        // Sohbet yalniz basvuru iliskisiyle acilir (aday da dahil)
        relate(biz, cand);

        // 1) Aday isletmeyle sohbet acsin (basvuruyla acilmis sohbet doner)
        StartConversationRequest start = new StartConversationRequest();
        start.setOtherPartyId(biz.userId);

        String convResp = mvc.perform(post("/api/messages/conversations")
                .header("Authorization", "Bearer " + cand.token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(start)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andReturn().getResponse().getContentAsString();
        Long convId = json.readTree(convResp).get("id").asLong();

        // 2) Ayni cift -> ayni sohbet (idempotent)
        String resp2 = mvc.perform(post("/api/messages/conversations")
                .header("Authorization", "Bearer " + cand.token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(start)))
            .andExpect(status().is2xxSuccessful())
            .andReturn().getResponse().getContentAsString();
        Long convId2 = json.readTree(resp2).get("id").asLong();
        assert convId.equals(convId2) : "Idempotent degil: " + convId + " vs " + convId2;

        // Basvurunun otomatik sistem mesajini isletme okusun (sayac 0'dan baslasin)
        mvc.perform(put("/api/messages/conversations/" + convId + "/read")
                .header("Authorization", "Bearer " + biz.token))
            .andExpect(status().isOk());

        // 3) Aday isletmeye mesaj atsin
        MessageRequest msg = new MessageRequest();
        msg.setContent("Merhaba, basvurum hakkinda konusabilir miyiz?");
        mvc.perform(post("/api/messages/conversations/" + convId + "/messages")
                .header("Authorization", "Bearer " + cand.token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(msg)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.content").value(msg.getContent()))
            .andExpect(jsonPath("$.senderId").value(cand.userId));

        // 4) Isletme tarafinda unread = 1
        mvc.perform(get("/api/messages/unread-count")
                .header("Authorization", "Bearer " + biz.token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.unread").value(1));

        // 5) Isletme conversation'a girip okundu yapar
        mvc.perform(put("/api/messages/conversations/" + convId + "/read")
                .header("Authorization", "Bearer " + biz.token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.updated").value(1));

        // 6) Tekrar unread sorgula -> 0
        mvc.perform(get("/api/messages/unread-count")
                .header("Authorization", "Bearer " + biz.token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void empty_message_is_rejected() throws Exception {
        Auth biz  = registerAndGetAuth(business("biz.msg2@test.com"));
        Auth cand = registerAndGetAuth(candidate("cand.msg2@test.com"));
        relate(biz, cand);

        StartConversationRequest start = new StartConversationRequest();
        start.setOtherPartyId(biz.userId);
        String convResp = mvc.perform(post("/api/messages/conversations")
                .header("Authorization", "Bearer " + cand.token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(start)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        Long convId = json.readTree(convResp).get("id").asLong();

        MessageRequest empty = new MessageRequest();
        empty.setContent("");

        mvc.perform(post("/api/messages/conversations/" + convId + "/messages")
                .header("Authorization", "Bearer " + cand.token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(empty)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void third_party_cannot_read_conversation() throws Exception {
        Auth biz  = registerAndGetAuth(business("biz.msg3@test.com"));
        Auth cand = registerAndGetAuth(candidate("cand.msg3@test.com"));
        Auth third = registerAndGetAuth(candidate("third.msg3@test.com"));
        relate(biz, cand);

        // Aday + isletme sohbet acar
        StartConversationRequest start = new StartConversationRequest();
        start.setOtherPartyId(biz.userId);
        String convResp = mvc.perform(post("/api/messages/conversations")
                .header("Authorization", "Bearer " + cand.token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(start)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        Long convId = json.readTree(convResp).get("id").asLong();

        // 3. kullanici sohbete sizmaya calisir -> 4xx
        mvc.perform(get("/api/messages/conversations/" + convId + "/messages")
                .header("Authorization", "Bearer " + third.token))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void business_cannot_start_conversation_with_candidate_who_never_applied() throws Exception {
        Auth biz  = registerAndGetAuth(business("biz.msg5@test.com"));
        Auth cand = registerAndGetAuth(candidate("cand.msg5@test.com"));

        StartConversationRequest start = new StartConversationRequest();
        start.setOtherPartyId(cand.userId);
        mvc.perform(post("/api/messages/conversations")
                .header("Authorization", "Bearer " + biz.token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(start)))
            .andExpect(status().isUnprocessableEntity());

        mvc.perform(get("/api/messages/conversations")
                .header("Authorization", "Bearer " + biz.token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(0));
    }

    @Test
    void candidate_cannot_start_conversation_without_relation_uniform_error() throws Exception {
        Auth biz  = registerAndGetAuth(business("biz.msg6@test.com"));
        Auth cand = registerAndGetAuth(candidate("cand.msg6@test.com"));
        Auth otherCand = registerAndGetAuth(candidate("cand2.msg6@test.com"));

        String unrelated = startAs(cand.token, biz.userId)
            .andExpect(status().isUnprocessableEntity())
            .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        // Var olmayan kullanici ve ayni rol (aday->aday) ayni tek tip hatayi alir
        String unknown = startAs(cand.token, 9_999_999L)
            .andExpect(status().isUnprocessableEntity())
            .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        String sameRole = startAs(cand.token, otherCand.userId)
            .andExpect(status().isUnprocessableEntity())
            .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        String m1 = json.readTree(unrelated).get("message").asText();
        assert m1.startsWith("Bu kişiyle sohbet başlatılamaz") : m1;
        assert m1.equals(json.readTree(unknown).get("message").asText());
        assert m1.equals(json.readTree(sameRole).get("message").asText());

        // Basvurduktan sonra acilir; DTO isletme id'sini tasir
        relate(biz, cand);
        startAs(cand.token, biz.userId)
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.otherPartyBusinessId").isNumber());
    }

    private org.springframework.test.web.servlet.ResultActions startAs(String token, Long otherId) throws Exception {
        StartConversationRequest start = new StartConversationRequest();
        start.setOtherPartyId(otherId);
        return mvc.perform(post("/api/messages/conversations")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(start)));
    }

    @Test
    void unauthenticated_cannot_send_message() throws Exception {
        // Iki kullaniciyla sohbet ac, sonra token'siz mesaj atmayi dene
        Auth biz  = registerAndGetAuth(business("biz.msg4@test.com"));
        Auth cand = registerAndGetAuth(candidate("cand.msg4@test.com"));
        relate(biz, cand);

        StartConversationRequest start = new StartConversationRequest();
        start.setOtherPartyId(biz.userId);
        String convResp = mvc.perform(post("/api/messages/conversations")
                .header("Authorization", "Bearer " + cand.token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(start)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        Long convId = json.readTree(convResp).get("id").asLong();

        MessageRequest msg = new MessageRequest();
        msg.setContent("token'siz dene");
        // Authorization header YOK -> auth filter 302 redirect veya 401 dönebilir
        mvc.perform(post("/api/messages/conversations/" + convId + "/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(msg)))
            .andExpect(result -> {
                int status = result.getResponse().getStatus();
                if (status < 300) throw new AssertionError(
                    "Token'siz mesaj kabul edildi! status=" + status);
            });
    }

    /* ─────────────────── Helpers ─────────────────── */

    @AllArgsConstructor
    static class Auth {
        Long userId;
        String token;
    }

    /** Aday, isletmenin yeni bir ilanina basvurur (sohbet iliskisi + otomatik sohbet). */
    private void relate(Auth biz, Auth cand) throws Exception {
        ShiftSlotCreate slot = new ShiftSlotCreate();
        slot.setDate(LocalDate.now().plusDays(7));
        slot.setStartTime(LocalTime.of(9, 0));
        slot.setEndTime(LocalTime.of(17, 0));
        slot.setSlotsNeeded(2);
        ListingRequest lr = new ListingRequest();
        lr.setPosition(Position.WAITER);
        lr.setJobType(JobType.PART_TIME);
        lr.setShift(Shift.MORNING);
        lr.setTitle("Test Garson");
        lr.setDescription("Test description");
        lr.setDressCode("Siyah pantolon, beyaz gomlek");
        lr.setPaymentPeriod(PaymentPeriod.SAME_DAY);
        lr.setPaymentMethod(PaymentMethod.CASH);
        lr.setShiftSlots(List.of(slot));
        String listingResp = mvc.perform(post("/api/listings")
                .header("Authorization", "Bearer " + biz.token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(lr)))
            .andExpect(status().is2xxSuccessful())
            .andReturn().getResponse().getContentAsString();
        long listingId = json.readTree(listingResp).get("id").asLong();
        String detail = mvc.perform(get("/api/listings/" + listingId)
                .header("Authorization", "Bearer " + cand.token))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        long slotId = json.readTree(detail).get("shiftSlots").get(0).get("id").asLong();
        ApplicationRequest ar = new ApplicationRequest();
        ar.setJobListingId(listingId);
        ar.setSlotIds(List.of(slotId));
        mvc.perform(post("/api/candidate/applications")
                .header("Authorization", "Bearer " + cand.token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(ar)))
            .andExpect(status().isCreated());
    }

    private Auth registerAndGetAuth(RegisterRequest req) throws Exception {
        String body = mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        JsonNode node = json.readTree(body);
        return new Auth(node.get("userId").asLong(), node.get("token").asText());
    }

    private RegisterRequest candidate(String email) {
        RegisterRequest r = new RegisterRequest();
        r.setTermsAccepted(true);              // KVKK onayi (V27)
        r.setPrivacyNoticeVersion("2026-10-17");
        r.setFullName("Aday Test");
        r.setEmail(email);
        r.setPassword("Test1234");
        r.setRole(Role.CANDIDATE);
        r.setPhone("0555 333 22 11");
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
