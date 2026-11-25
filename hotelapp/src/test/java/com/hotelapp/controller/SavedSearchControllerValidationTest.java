package com.hotelapp.controller;

import com.hotelapp.config.Messages;
import com.hotelapp.entity.SavedSearch;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.GlobalExceptionHandler;
import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.SavedSearchService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Kayıtlı arama formu: kolon sınırlarını aşan istek DB'ye inmeden 400 + Türkçe alan
 * mesajı döner (eskiden CreatePayload'da kısıt yoktu, @Valid etkisizdi → 500).
 */
class SavedSearchControllerValidationTest {

    private static final long USER_ID = 42L;

    private SavedSearchService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        service = mock(SavedSearchService.class);
        mvc = MockMvcBuilders.standaloneSetup(new SavedSearchController(service))
                .setControllerAdvice(new GlobalExceptionHandler(mock(Messages.class)))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();
        User u = User.builder().id(USER_ID).email("aday@example.test").role(Role.CANDIDATE).build();
        UserPrincipal principal = new UserPrincipal(u);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static String json(String name, String district, String keyword, String minSalary) {
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"name\":").append(name == null ? "null" : "\"" + name + "\"");
        if (district != null) sb.append(",\"district\":\"").append(district).append('"');
        if (keyword != null) sb.append(",\"keyword\":\"").append(keyword).append('"');
        if (minSalary != null) sb.append(",\"minSalary\":").append(minSalary);
        return sb.append('}').toString();
    }

    @Test
    void tooLongName_returns400WithTurkishMessage_serviceNotCalled() throws Exception {
        mvc.perform(post("/api/saved-searches").contentType(MediaType.APPLICATION_JSON)
                        .content(json("a".repeat(101), null, null, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.name").value("Arama adı en fazla 100 karakter olabilir."));
        verifyNoInteractions(service);
    }

    @Test
    void blankName_returns400() throws Exception {
        mvc.perform(post("/api/saved-searches").contentType(MediaType.APPLICATION_JSON)
                        .content(json("   ", null, null, null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.name").value("Arama adı zorunlu."));
        verifyNoInteractions(service);
    }

    @Test
    void tooLongKeywordAndDistrict_return400() throws Exception {
        mvc.perform(post("/api/saved-searches").contentType(MediaType.APPLICATION_JSON)
                        .content(json("Gece garson", "d".repeat(65), "k".repeat(256), null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.keyword").value("Anahtar kelime en fazla 255 karakter olabilir."))
                .andExpect(jsonPath("$.fields.district").value("İlçe en fazla 64 karakter olabilir."));
        verifyNoInteractions(service);
    }

    @Test
    void negativeOrOversizedMinSalary_return400() throws Exception {
        mvc.perform(post("/api/saved-searches").contentType(MediaType.APPLICATION_JSON)
                        .content(json("Gece garson", null, null, "-1")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.minSalary").value("En az ücret negatif olamaz."));
        mvc.perform(post("/api/saved-searches").contentType(MediaType.APPLICATION_JSON)
                        .content(json("Gece garson", null, null, "12345678901")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.minSalary").exists());
        verifyNoInteractions(service);
    }

    @Test
    void boundaryValues_areAccepted() throws Exception {
        SavedSearch saved = SavedSearch.builder().id(5L).name("a".repeat(100)).build();
        saved.setCreatedAt(LocalDateTime.of(2026, 11, 25, 12, 0));
        when(service.create(eq(USER_ID), any())).thenReturn(saved);

        mvc.perform(post("/api/saved-searches").contentType(MediaType.APPLICATION_JSON)
                        .content(json("a".repeat(100), "d".repeat(64), "k".repeat(255), "1500.50")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(5));
        verify(service).create(eq(USER_ID), any(SavedSearchService.CreatePayload.class));
    }

    @Test
    void tooLongNameOnRename_returns400() throws Exception {
        mvc.perform(patch("/api/saved-searches/5").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + "a".repeat(101) + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.name").value("Arama adı en fazla 100 karakter olabilir."));
        verify(service, org.mockito.Mockito.never()).update(anyLong(), anyLong(), any());
    }
}
