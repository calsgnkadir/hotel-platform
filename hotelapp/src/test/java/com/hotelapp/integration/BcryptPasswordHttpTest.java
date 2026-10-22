package com.hotelapp.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP boundary regression for the BCrypt maximum encoded input length. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BcryptPasswordHttpTest {

    @Autowired MockMvc mvc;

    @Test
    void overlongLoginIsClientErrorAndDoesNotReachBcrypt() throws Exception {
        String password = "A1" + "a".repeat(71); // 73 ASCII bytes
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"synthetic@example.test\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.password").value("Şifre en fazla 72 UTF-8 bayt olabilir"));
    }

    @Test
    void apiPathPatternKeepsUnauthenticatedApiResponseAt401() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized());
    }
}
