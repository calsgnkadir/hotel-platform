package com.hotelapp.integration;

import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.PushSubscriptionRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.RefreshTokenService;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Push aboneliği HTTP katmanında: SSRF reddi ve çıkışta cihazın koparılması. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PushSubscriptionHttpTest {

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PushSubscriptionRepository subscriptions;
    @Autowired RefreshTokenService refreshTokens;

    private User create() {
        return users.save(User.builder().email(UUID.randomUUID() + "@test.com").fullName("Test").role(Role.CANDIDATE).build());
    }

    private static String body(String endpoint) {
        return "{\"endpoint\":\"" + endpoint + "\",\"keys\":{\"p256dh\":\"K\",\"auth\":\"A\"}}";
    }

    @Test
    void internalAddressIsRejected_realPushServiceIsSaved() throws Exception {
        User u = create();
        mvc.perform(post("/api/push/subscribe").with(user(new UserPrincipal(u))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body("http://127.0.0.1:8080/actuator")))
                .andExpect(status().isUnprocessableEntity());
        assertThat(subscriptions.findByEndpoint("http://127.0.0.1:8080/actuator")).isEmpty();

        String fcm = "https://fcm.googleapis.com/fcm/send/" + UUID.randomUUID();
        mvc.perform(post("/api/push/subscribe").with(user(new UserPrincipal(u))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(fcm)))
                .andExpect(status().isOk());
        assertThat(subscriptions.findByEndpoint(fcm)).isPresent();
    }

    @Test
    void logoutWithPushEndpoint_detachesThisDevice_evenWithoutAccessToken() throws Exception {
        User u = create();
        String fcm = "https://fcm.googleapis.com/fcm/send/" + UUID.randomUUID();
        mvc.perform(post("/api/push/subscribe").with(user(new UserPrincipal(u))).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(body(fcm)))
                .andExpect(status().isOk());
        String rawRefresh = refreshTokens.createForUser(u);

        // Erişim token'ı yok; kullanıcı yalnızca refresh çerezinden bulunur
        mvc.perform(post("/api/auth/logout").with(csrf()).cookie(new Cookie("refreshToken", rawRefresh))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"pushEndpoint\":\"" + fcm + "\"}"))
                .andExpect(status().isOk());

        assertThat(subscriptions.findByEndpoint(fcm)).isEmpty();
    }

    @Test
    void logoutWithoutBody_stillWorks() throws Exception {
        User u = create();
        mvc.perform(post("/api/auth/logout").with(csrf()).cookie(new Cookie("refreshToken", refreshTokens.createForUser(u))))
                .andExpect(status().isOk());
    }
}
