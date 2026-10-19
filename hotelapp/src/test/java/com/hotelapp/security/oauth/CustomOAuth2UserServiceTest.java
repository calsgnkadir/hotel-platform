package com.hotelapp.security.oauth;

import com.hotelapp.entity.User;
import com.hotelapp.enums.AuthProvider;
import com.hotelapp.enums.Role;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.service.RefreshTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Google girişi DB tarafı (Google'a çağrı yok): doğrulanmamış LOCAL hesabın bağlanması
 * hesap ele geçirmeye yol açmamalı; Google e-postası doğrulanmış sayılır.
 */
class CustomOAuth2UserServiceTest {

    private UserRepository users;
    private RefreshTokenService refreshTokens;
    private CustomOAuth2UserService service;
    private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        refreshTokens = mock(RefreshTokenService.class);
        service = new CustomOAuth2UserService(users, refreshTokens);
        when(users.save(any())).thenAnswer(i -> {
            User u = i.getArgument(0);
            if (u.getId() == null) u.setId(500L);
            return u;
        });
    }

    private static Map<String, Object> google(String email) {
        return Map.of("email", email, "name", "Gercek Sahip", "sub", "google-sub-1", "email_verified", true);
    }

    private User local(boolean verified) {
        return User.builder().id(5L).email("kisi@test.com").fullName("Onceden Kaydolan")
                .password(enc.encode("Saldirgan123")).role(Role.CANDIDATE)
                .provider(AuthProvider.LOCAL).enabled(true)
                .emailVerifiedAt(verified ? LocalDateTime.now().minusDays(1) : null)
                .build();
    }

    @Test
    @DisplayName("Doğrulanmamış LOCAL hesap: parola kullanılamaz olur, tüm oturumlar kapanır, e-posta doğrulanır")
    void unverifiedLocal_isTakenOverSafely() {
        User u = local(false);
        String oldHash = u.getPassword();
        when(users.findByEmail("kisi@test.com")).thenReturn(Optional.of(u));

        service.upsertGoogleUser(google("Kisi@Test.com "));

        assertThat(u.getProvider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(u.getProviderId()).isEqualTo("google-sub-1");
        assertThat(u.getPassword()).isNotBlank().isNotEqualTo(oldHash);
        assertThat(enc.matches("Saldirgan123", u.getPassword())).isFalse();
        assertThat(u.getEmailVerifiedAt()).isNotNull();
        verify(refreshTokens).revokeAllForUser(5L);
        verify(users).save(u);
    }

    @Test
    @DisplayName("Doğrulanmış LOCAL hesap: parola ve oturumlar korunur (kullanıcının kendisi)")
    void verifiedLocal_keepsPassword() {
        User u = local(true);
        String oldHash = u.getPassword();
        LocalDateTime verifiedAt = u.getEmailVerifiedAt();
        when(users.findByEmail("kisi@test.com")).thenReturn(Optional.of(u));

        service.upsertGoogleUser(google("kisi@test.com"));

        assertThat(u.getPassword()).isEqualTo(oldHash);
        assertThat(u.getEmailVerifiedAt()).isEqualTo(verifiedAt);
        assertThat(u.getProvider()).isEqualTo(AuthProvider.GOOGLE);
        verifyNoInteractions(refreshTokens);
    }

    @Test
    @DisplayName("Mevcut GOOGLE hesabı: doğrulama zamanı yoksa yazılır, parola değişmez")
    void existingGoogle_getsVerifiedAt() {
        User u = local(false);
        u.setProvider(AuthProvider.GOOGLE);
        String hash = u.getPassword();
        when(users.findByEmail("kisi@test.com")).thenReturn(Optional.of(u));

        service.upsertGoogleUser(google("kisi@test.com"));

        assertThat(u.getEmailVerifiedAt()).isNotNull();
        assertThat(u.getPassword()).isEqualTo(hash);
        verifyNoInteractions(refreshTokens);
    }

    @Test
    @DisplayName("Yeni Google kullanıcısı: CANDIDATE, kullanılamaz parola, e-posta doğrulanmış; KVKK onayı burada yazılmaz")
    void newGoogleUser_isVerified() {
        when(users.findByEmail("yeni@test.com")).thenReturn(Optional.empty());

        User u = service.upsertGoogleUser(google("yeni@test.com"));

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(users).save(captor.capture());
        User saved = captor.getValue();
        assertThat(saved).isSameAs(u);
        assertThat(saved.getRole()).isEqualTo(Role.CANDIDATE);
        assertThat(saved.getProvider()).isEqualTo(AuthProvider.GOOGLE);
        assertThat(saved.getEmailVerifiedAt()).isNotNull();
        assertThat(saved.getPassword()).isNotBlank().startsWith("$2");
        assertThat(saved.getTermsAcceptedAt()).isNull();
    }

    @Test
    @DisplayName("Kapalı/banlı hesap Google ile de giremez")
    void bannedUser_rejected() {
        User u = local(true);
        u.setBannedUntil(LocalDateTime.now().plusDays(1));
        when(users.findByEmail("kisi@test.com")).thenReturn(Optional.of(u));

        assertThatThrownBy(() -> service.upsertGoogleUser(google("kisi@test.com")))
                .isInstanceOf(OAuth2AuthenticationException.class);
        verify(users, never()).save(any());
    }
}
