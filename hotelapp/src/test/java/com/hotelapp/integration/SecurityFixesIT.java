package com.hotelapp.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.dto.LoginRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.entity.User;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.security.oauth.OAuth2SuccessHandler;
import com.hotelapp.security.oauth.OAuthLoginCodeStore;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Güvenlik düzeltmeleri uçtan uca (H2): 403/401 ayrımı, kilitli/kapalı hesap girişi,
 * kayıt hatasında e-posta yansıtılmaması, OAuth tek kullanımlık kod, web sitesi şeması.
 * Sınıf anotasyonları SecurityHardeningIT ile aynı (Spring test bağlamı paylaşılır).
 */
@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability(tracing = false)
@ActiveProfiles("test")
class SecurityFixesIT {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository userRepository;
    @Autowired private OAuthLoginCodeStore codeStore;
    @Autowired private OAuth2SuccessHandler oAuth2SuccessHandler;

    // ---------------- 403 / 401 ----------------

    @Test
    @DisplayName("Girişli ama yanlış rol → 403 + Türkçe JSON; girişsiz → 401")
    void wrongRoleIs403_anonymousIs401() throws Exception {
        String candToken = register(candidate("rol.aday@test.com")).get("token").asText();

        mvc.perform(put("/api/business/profile")
                        .header("Authorization", "Bearer " + candToken)
                        .header("Accept-Language", "tr")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\",\"type\":\"HOTEL\"}"))
                .andExpect(status().isForbidden())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.message").value("Bu işlemi yapmaya yetkiniz yok"));

        mvc.perform(put("/api/business/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\",\"type\":\"HOTEL\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ---------------- Kilitli / kapalı hesap ----------------

    @Test
    @DisplayName("Banlı hesap: yanlış şifrede genel 401 (ifşa yok), doğru şifrede 401 + ban bitişi (500 değil)")
    void bannedLogin() throws Exception {
        long id = register(candidate("ban.giris@test.com")).get("userId").asLong();
        User u = userRepository.findById(id).orElseThrow();
        LocalDateTime until = LocalDateTime.of(2099, 1, 2, 3, 4);
        u.setBannedUntil(until);
        userRepository.save(u);

        login("ban.giris@test.com", "YanlisSifre9")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("E-posta veya şifre hatalı"));

        login("ban.giris@test.com", "Test1234")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(containsString("02.01.2099 03:04")))
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    @Test
    @DisplayName("Kapalı (silme talepli) hesap: yanlış şifrede genel 401, doğru şifrede 401 + genel kapalı mesajı")
    void disabledLogin() throws Exception {
        long id = register(candidate("kapali.giris@test.com")).get("userId").asLong();
        User u = userRepository.findById(id).orElseThrow();
        u.setEnabled(false);
        userRepository.save(u);

        login("kapali.giris@test.com", "YanlisSifre9")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("E-posta veya şifre hatalı"));

        login("kapali.giris@test.com", "Test1234")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(containsString("kullanıma kapalı")));
    }

    @Test
    @DisplayName("Kayıt: e-posta kayıtlıysa 422, mesaj e-postayı yansıtmaz")
    void duplicateRegisterDoesNotEchoEmail() throws Exception {
        register(candidate("yansima.yok@test.com"));
        mvc.perform(post("/api/auth/register")
                        .header("Accept-Language", "tr")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(candidate("yansima.yok@test.com"))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value(not(containsString("yansima.yok"))))
                .andExpect(jsonPath("$.message").value(containsString("zaten bir hesap var")));
    }

    // ---------------- OAuth tek kullanımlık kod ----------------

    @Test
    @DisplayName("OAuth dönüşü: adreste yalnız #code= (JWT/e-posta yok); kod bir kez oturuma çevrilir")
    void oauthCodeExchange() throws Exception {
        long id = register(candidate("google.kod@test.com")).get("userId").asLong();

        var principal = new DefaultOAuth2User(List.of(() -> "ROLE_CANDIDATE"),
                Map.of("userId", id, "email", "google.kod@test.com", "name", "Aday Test", "role", "CANDIDATE"),
                "email");
        MockHttpServletResponse redirect = new MockHttpServletResponse();
        oAuth2SuccessHandler.onAuthenticationSuccess(new MockHttpServletRequest(), redirect,
                new TestingAuthenticationToken(principal, null));
        String location = redirect.getRedirectedUrl();
        assertThat(location).contains("/oauth-success#code=")
                .doesNotContain("?").doesNotContain("token=").doesNotContain("google.kod");
        String code = location.substring(location.indexOf("#code=") + 6);

        mvc.perform(post("/api/auth/oauth/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.userId").value(id))
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(cookie().httpOnly("refreshToken", true));

        // Tek kullanımlık: ikinci deneme 422 (401 değil — frontend oturum yenilemeye çalışmasın)
        mvc.perform(post("/api/auth/oauth/exchange")
                        .header("Accept-Language", "tr")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    @Test
    @DisplayName("OAuth kodu: hesap bu arada kapatıldıysa oturum verilmez")
    void oauthCodeRejectedForDisabledUser() throws Exception {
        long id = register(candidate("google.kapali@test.com")).get("userId").asLong();
        String code = codeStore.issue(id);
        User u = userRepository.findById(id).orElseThrow();
        u.setEnabled(false);
        userRepository.save(u);

        mvc.perform(post("/api/auth/oauth/exchange")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"" + code + "\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.token").doesNotExist());
    }

    // ---------------- Web sitesi şeması ----------------

    @Test
    @DisplayName("İşletme profili: javascript: web sitesi 422; https kabul")
    void businessWebsiteScheme() throws Exception {
        String bizToken = register(business("site.sema@test.com")).get("token").asText();

        mvc.perform(put("/api/business/profile")
                        .header("Authorization", "Bearer " + bizToken)
                        .header("Accept-Language", "tr")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test Otel\",\"type\":\"HOTEL\",\"website\":\"javascript:alert(1)\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value(containsString("https://")));

        mvc.perform(put("/api/business/profile")
                        .header("Authorization", "Bearer " + bizToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test Otel\",\"type\":\"HOTEL\",\"website\":\"https://www.isletmem.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.website").value("https://www.isletmem.com"));
    }

    // ---------------- Helpers ----------------

    private org.springframework.test.web.servlet.ResultActions login(String email, String password) throws Exception {
        LoginRequest l = new LoginRequest();
        l.setEmail(email);
        l.setPassword(password);
        return mvc.perform(post("/api/auth/login")
                .header("Accept-Language", "tr")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(l)));
    }

    private JsonNode register(RegisterRequest req) throws Exception {
        MvcResult r = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andReturn();
        return json.readTree(r.getResponse().getContentAsString());
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
