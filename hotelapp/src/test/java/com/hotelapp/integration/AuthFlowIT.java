package com.hotelapp.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.dto.LoginRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import jakarta.servlet.http.Cookie;

import static org.assertj.core.api.Assertions.assertThat;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * FAZ 0/#4a — Register + Login + Refresh akisi (integration test).
 *
 * Kapsam:
 *  - Aday ve isletme register basarili
 *  - Duplicate email registry reddedilir
 *  - Zayif sifre (rakam yok) reddedilir
 *  - role=ADMIN ile kendi kendine kayit reddedilir, kullanici yazilmaz (guvenlik regresyonu)
 *  - Login dogru sifre ile token doner
 *  - Login yanlis sifre ile 401
 *  - Refresh cookie ile yeni access token doner
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowIT {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository userRepository;

    /* ───────────────────────── REGISTER ───────────────────────── */

    @Test
    void register_candidate_succeeds() throws Exception {
        RegisterRequest req = candidate("aday.basarili@test.com");

        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").exists())
            .andExpect(jsonPath("$.userId").exists())
            .andExpect(jsonPath("$.email").value("aday.basarili@test.com"))
            .andExpect(jsonPath("$.role").value("CANDIDATE"))
            // Refresh token cookie'de — body'de gozukmemeli
            .andExpect(jsonPath("$.refreshToken").doesNotExist())
            .andExpect(cookie().exists("refreshToken"))
            .andExpect(cookie().httpOnly("refreshToken", true));
    }

    @Test
    void register_business_succeeds() throws Exception {
        RegisterRequest req = business("isletme.basarili@test.com");

        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("BUSINESS_OWNER"))
            .andExpect(jsonPath("$.token").exists());
    }

    @Test
    void register_duplicate_email_is_rejected() throws Exception {
        RegisterRequest first = candidate("duplicate@test.com");

        // 1) ilk kayit basarili
        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(first)))
            .andExpect(status().isOk());

        // 2) ayni email ile tekrar — reddedilmeli
        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(first)))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void register_weak_password_no_digit_is_rejected() throws Exception {
        RegisterRequest req = candidate("zayif@test.com");
        req.setPassword("OnlyLetters");  // rakam yok — FAZ 4.4 policy ihlali

        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void register_short_password_is_rejected() throws Exception {
        RegisterRequest req = candidate("kisa@test.com");
        req.setPassword("Ab1");  // 8 karakterden az

        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().isBadRequest());
    }

    @Test
    void register_with_admin_role_is_rejected_and_not_persisted() throws Exception {
        RegisterRequest req = candidate("admin.deneme@test.com");
        req.setRole(Role.ADMIN);

        String body = mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.token").doesNotExist())
            .andExpect(cookie().doesNotExist("refreshToken"))
            .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);

        // Hata yaniti ADMIN rolunun varligini ifsa etmemeli
        assertThat(body).doesNotContain("ADMIN").contains("Geçersiz rol seçimi");
        assertThat(userRepository.existsByEmail("admin.deneme@test.com")).isFalse();
    }

    @Test
    void register_with_admin_role_raw_json_is_rejected_and_not_persisted() throws Exception {
        // Saldirganin elle yazdigi ham JSON (DTO serilestirmesinden bagimsiz)
        String raw = """
            {"fullName":"Saldirgan","email":"admin.raw@test.com","password":"Test1234",
             "role":"ADMIN","phone":"0555 123 45 67","roleAllowedForSelfRegistration":true}
            """;

        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(raw))
            .andExpect(status().is4xxClientError())
            .andExpect(jsonPath("$.token").doesNotExist());

        assertThat(userRepository.existsByEmail("admin.raw@test.com")).isFalse();
    }

    /* ───────────────────────── LOGIN ───────────────────────── */

    @Test
    void login_with_correct_credentials_returns_token() throws Exception {
        // 1) Once kayit
        RegisterRequest reg = candidate("login.ok@test.com");
        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)))
            .andExpect(status().isOk());

        // 2) Login
        LoginRequest login = new LoginRequest();
        login.setEmail("login.ok@test.com");
        login.setPassword("Test1234");

        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").exists())
            .andExpect(jsonPath("$.email").value("login.ok@test.com"))
            .andExpect(cookie().exists("refreshToken"));
    }

    @Test
    void login_with_wrong_password_returns_unauthorized() throws Exception {
        RegisterRequest reg = candidate("wrong.pwd@test.com");
        mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)))
            .andExpect(status().isOk());

        LoginRequest login = new LoginRequest();
        login.setEmail("wrong.pwd@test.com");
        login.setPassword("YanlisSifre1");

        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
            .andExpect(status().is4xxClientError());
    }

    @Test
    void login_nonexistent_user_returns_unauthorized() throws Exception {
        LoginRequest login = new LoginRequest();
        login.setEmail("yok.boyle.user@test.com");
        login.setPassword("Whatever1");

        mvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(login)))
            .andExpect(status().is4xxClientError());
    }

    /* ───────────────────────── REFRESH ───────────────────────── */

    @Test
    void refresh_with_valid_cookie_returns_new_token() throws Exception {
        // 1) Register + refresh cookie al
        RegisterRequest reg = candidate("refresh.ok@test.com");
        var regResult = mvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(reg)))
            .andExpect(status().isOk())
            .andReturn();

        Cookie refreshCookie = regResult.getResponse().getCookie("refreshToken");
        assert refreshCookie != null : "refreshToken cookie konmamis";

        // 2) Cookie ile refresh
        mvc.perform(post("/api/auth/refresh").cookie(refreshCookie))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").exists())
            .andExpect(cookie().exists("refreshToken"));
    }

    @Test
    void refresh_without_cookie_returns_unauthorized() throws Exception {
        mvc.perform(post("/api/auth/refresh"))
            .andExpect(status().is4xxClientError());
    }

    /* ───────────────────────── helpers ───────────────────────── */

    private RegisterRequest candidate(String email) {
        RegisterRequest r = new RegisterRequest();
        r.setFullName("Test Aday");
        r.setEmail(email);
        r.setPassword("Test1234");
        r.setRole(Role.CANDIDATE);
        r.setPhone("0555 123 45 67");
        return r;
    }

    private RegisterRequest business(String email) {
        RegisterRequest r = new RegisterRequest();
        r.setFullName("Test Yonetici");
        r.setEmail(email);
        r.setPassword("Biz1234A");
        r.setRole(Role.BUSINESS_OWNER);
        r.setPhone("0555 999 88 77");
        r.setBusinessName("Test Isletme");
        r.setBusinessType(com.hotelapp.enums.BusinessType.HOTEL);
        r.setDistrict("Beyoglu");
        r.setBusinessPhone("0212 555 12 34");
        return r;
    }
}
