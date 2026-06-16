package com.hotelapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.dto.MessageRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.dto.StartConversationRequest;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.Role;
import lombok.AllArgsConstructor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

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

        // 1) Aday isletmeyle sohbet acsin
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
    void unauthenticated_cannot_send_message() throws Exception {
        // Iki kullaniciyla sohbet ac, sonra token'siz mesaj atmayi dene
        Auth biz  = registerAndGetAuth(business("biz.msg4@test.com"));
        Auth cand = registerAndGetAuth(candidate("cand.msg4@test.com"));

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
        r.setFullName("Aday Test");
        r.setEmail(email);
        r.setPassword("Test1234");
        r.setRole(Role.CANDIDATE);
        r.setPhone("0555 333 22 11");
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
