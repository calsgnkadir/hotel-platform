package com.hotelapp.exception;

import com.hotelapp.config.Messages;
import jakarta.servlet.http.HttpServletRequest;
import org.hibernate.query.sqm.UnknownPathException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.InvalidDataAccessApiUsageException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.mockito.Mockito.mock;

class GlobalExceptionHandlerSortTest {

    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new SortEndpoint())
                .setControllerAdvice(new GlobalExceptionHandler(mock(Messages.class)))
                .build();
    }

    @Test
    void unknownSortPropertyWrappedBySpringDataErrorReturnsGenericBadRequest() throws Exception {
        mvc.perform(get("/api/candidate/applications").param("sort", "missingField,asc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message").value("Sıralama alanı geçersiz."))
                .andExpect(jsonPath("$.message", not(containsString("missingField"))));
    }

    @Test
    void validSortControlStillReturnsSuccess() throws Exception {
        mvc.perform(get("/api/candidate/applications").param("sort", "createdAt,desc"))
                .andExpect(status().isOk());
    }

    @Test
    void unrelatedJpaUsageErrorRemainsServerError() throws Exception {
        mvc.perform(get("/repository-error").param("sort", "createdAt,desc"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value(
                        "Beklenmeyen bir hata oluştu. Sorun devam ederse destek ekibimize bildirin."));
    }

    @RestController
    static class SortEndpoint {
        @GetMapping("/api/candidate/applications")
        ResponseEntity<String> list(HttpServletRequest request) {
            if ("missingField,asc".equals(request.getParameter("sort"))) {
                throw new InvalidDataAccessApiUsageException(
                        "Invalid sort path", new UnknownPathException("Could not resolve missing path"));
            }
            return ResponseEntity.ok("ok");
        }

        @GetMapping("/repository-error")
        void repositoryError() {
            throw new InvalidDataAccessApiUsageException("Unexpected repository API misuse");
        }
    }
}
