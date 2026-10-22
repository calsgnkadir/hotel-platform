package com.hotelapp.service;

import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.security.JwtService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Guvenlik regresyonu: kendi kendine kayitta yalniz CANDIDATE ve BUSINESS_OWNER
 * kabul edilir; "role":"ADMIN" hem DTO dogrulamasinda hem serviste reddedilir.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private BusinessRepository businessRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private EmailService emailService;
    @Mock private EmailTemplates emailTemplates;
    @Mock private EmailVerificationService emailVerificationService;
    @Mock private JwtService jwtService;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private PushSubscriptionService pushSubscriptionService;
    @Mock private com.hotelapp.security.oauth.OAuthLoginCodeStore oAuthLoginCodeStore;
    @InjectMocks private AuthService authService;

    // ── KVKK onay kaydı ───────────────────────────────────────────────

    @Test
    @DisplayName("Kayit: termsAccepted true degilse 422, kullanici yazilmaz")
    void register_withoutTerms_rejected() {
        for (Boolean v : new Boolean[]{null, false}) {
            RegisterRequest req = request(Role.CANDIDATE);
            req.setTermsAccepted(v);
            assertThatThrownBy(() -> authService.register(req))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessage("Kullanım Şartları kabul edilmeli.");
        }
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Kayit: Aydinlatma Metni surumu eksik/gecersizse 422")
    void register_withoutNoticeVersion_rejected() {
        for (String v : new String[]{null, " ", "x".repeat(33), "2026 10 17<script>"}) {
            RegisterRequest req = request(Role.CANDIDATE);
            req.setPrivacyNoticeVersion(v);
            assertThatThrownBy(() -> authService.register(req))
                    .isInstanceOf(BusinessRuleException.class)
                    .hasMessageContaining("Aydınlatma Metni");
        }
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Kayit: onay zamani ve surum kaydedilir")
    void register_recordsConsent() {
        RegisterRequest req = request(Role.CANDIDATE);
        req.setPrivacyNoticeVersion(" 2026-10-17 ");
        authService.register(req);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        User u = captor.getValue();
        assertThat(u.getTermsAcceptedAt()).isNotNull();
        assertThat(u.getPrivacyNoticeVersion()).isEqualTo("2026-10-17");
        assertThat(u.getPrivacyNoticeAckAt()).isNotNull();
    }

    private User googleUser(boolean hasConsent) {
        User u = User.builder().id(77L).email("g@test.com").fullName("G").role(Role.CANDIDATE)
                .provider(com.hotelapp.enums.AuthProvider.GOOGLE).enabled(true).build();
        if (hasConsent) u.setTermsAcceptedAt(java.time.LocalDateTime.now().minusDays(3));
        return u;
    }

    @Test
    @DisplayName("OAuth exchange: onay kaydi yok ve onay gelmedi -> 422 CONSENT_REQUIRED, kod TUKETILMEZ")
    void exchange_withoutConsent_requiresConsent_keepsCode() {
        when(oAuthLoginCodeStore.peek("kod")).thenReturn(java.util.Optional.of(77L));
        when(userRepository.findById(77L)).thenReturn(java.util.Optional.of(googleUser(false)));

        assertThatThrownBy(() -> authService.exchangeOAuthCode("kod", null, null))
                .isInstanceOf(com.hotelapp.exception.ConsentRequiredException.class)
                .satisfies(ex -> assertThat(((com.hotelapp.exception.CodedError) ex).getCode())
                        .isEqualTo("CONSENT_REQUIRED"));
        assertThatThrownBy(() -> authService.exchangeOAuthCode("kod", false, "2026-10-17"))
                .isInstanceOf(com.hotelapp.exception.ConsentRequiredException.class);
        verify(oAuthLoginCodeStore, never()).consume(any());
        verifyNoInteractions(refreshTokenService, jwtService);
    }

    @Test
    @DisplayName("OAuth exchange: onayla gelirse kaydedilir ve oturum acilir")
    void exchange_withConsent_recordsAndLogsIn() {
        User u = googleUser(false);
        when(oAuthLoginCodeStore.peek("kod")).thenReturn(java.util.Optional.of(77L));
        when(oAuthLoginCodeStore.consume("kod")).thenReturn(java.util.Optional.of(77L));
        when(userRepository.findById(77L)).thenReturn(java.util.Optional.of(u));
        when(jwtService.generateToken(u)).thenReturn("jwt");

        var res = authService.exchangeOAuthCode("kod", true, "2026-10-17");

        assertThat(res.getToken()).isEqualTo("jwt");
        assertThat(u.getTermsAcceptedAt()).isNotNull();
        assertThat(u.getPrivacyNoticeVersion()).isEqualTo("2026-10-17");
        verify(userRepository).save(u);
    }

    @Test
    @DisplayName("OAuth exchange: onay kaydi varsa alan istenmez; yeni surum gelirse guncellenir")
    void exchange_existingConsent_optionalNewVersion() {
        User u = googleUser(true);
        u.setPrivacyNoticeVersion("2026-01-01");
        when(oAuthLoginCodeStore.peek(anyString())).thenReturn(java.util.Optional.of(77L));
        when(oAuthLoginCodeStore.consume(anyString())).thenReturn(java.util.Optional.of(77L));
        when(userRepository.findById(77L)).thenReturn(java.util.Optional.of(u));

        authService.exchangeOAuthCode("kod1", null, null);
        assertThat(u.getPrivacyNoticeVersion()).isEqualTo("2026-01-01");
        verify(userRepository, never()).save(any());

        authService.exchangeOAuthCode("kod2", true, "2026-10-17");
        assertThat(u.getPrivacyNoticeVersion()).isEqualTo("2026-10-17");
    }

    @Test
    @DisplayName("OAuth exchange: kod bu arada kullanildiysa (yaris) 422, oturum yok")
    void exchange_codeRace_rejected() {
        when(oAuthLoginCodeStore.peek("kod")).thenReturn(java.util.Optional.of(77L));
        when(oAuthLoginCodeStore.consume("kod")).thenReturn(java.util.Optional.empty());
        when(userRepository.findById(77L)).thenReturn(java.util.Optional.of(googleUser(true)));

        assertThatThrownBy(() -> authService.exchangeOAuthCode("kod", null, null))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessage("error.auth.oauthCodeInvalid");
        verifyNoInteractions(refreshTokenService, jwtService);
    }

    @Test
    @DisplayName("Kayit: role=ADMIN serviste reddedilir, kullanici kaydedilmez")
    void register_adminRole_rejectedBeforeSave() {
        RegisterRequest req = request(Role.ADMIN);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessage("Geçersiz rol seçimi")
                .hasMessageNotContaining("ADMIN");

        verify(userRepository, never()).save(any());
        verify(userRepository, never()).existsByEmail(anyString());
        verifyNoInteractions(businessRepository, refreshTokenService, jwtService,
                emailService, emailVerificationService, passwordEncoder);
    }

    @Test
    @DisplayName("Kayıt: 72 UTF-8 baytı aşan parola hashlenmeden reddedilir")
    void register_overlongPassword_rejectedBeforeEncoding() {
        RegisterRequest req = request(Role.CANDIDATE);
        req.setPassword("A1" + "a".repeat(71));

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(BusinessRuleException.class)
                .extracting(e -> ((BusinessRuleException) e).getMessageKey())
                .isEqualTo("error.auth.passwordTooLong");
        verify(passwordEncoder, never()).encode(anyString());
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Şifre değişimi: 72 UTF-8 baytı aşan eski veya yeni parola okunmadan/hashlenmeden reddedilir")
    void changePassword_rejectsOverlongCurrentOrNewPassword() {
        for (boolean oldPasswordOverlong : new boolean[]{true, false}) {
            var req = new AuthService.ChangePasswordRequest();
            req.setCurrentPassword(oldPasswordOverlong ? "A1" + "a".repeat(71) : "Current123");
            req.setNewPassword(oldPasswordOverlong ? "NewPass123" : "B1" + "b".repeat(71));

            assertThatThrownBy(() -> authService.changePassword(77L, req))
                    .isInstanceOf(BusinessRuleException.class)
                    .extracting(e -> ((BusinessRuleException) e).getMessageKey())
                    .isEqualTo("error.auth.passwordTooLong");
        }
        verify(userRepository, never()).findById(any());
        verify(passwordEncoder, never()).encode(anyString());
        verify(passwordEncoder, never()).matches(anyString(), anyString());
    }

    @Test
    @DisplayName("Şifre değişimi: mevcut ve yeni parola tam 72 UTF-8 baytta doğrulanıp güncellenir")
    void changePassword_acceptsExactly72Utf8BytesForCurrentAndNewPassword() {
        String current72 = "C1" + "c".repeat(68) + "é";
        String new72 = "N1" + "n".repeat(70);
        User user = User.builder().id(77L).email("person@example.test").password("old-hash")
                .role(Role.CANDIDATE).build();
        when(userRepository.findById(77L)).thenReturn(java.util.Optional.of(user));
        when(passwordEncoder.matches(current72, "old-hash")).thenReturn(true);
        when(passwordEncoder.encode(new72)).thenReturn("new-hash");

        var req = new AuthService.ChangePasswordRequest();
        req.setCurrentPassword(current72);
        req.setNewPassword(new72);

        authService.changePassword(77L, req);

        assertThat(current72.getBytes(java.nio.charset.StandardCharsets.UTF_8)).hasSize(72);
        assertThat(new72.getBytes(java.nio.charset.StandardCharsets.UTF_8)).hasSize(72);
        assertThat(user.getPassword()).isEqualTo("new-hash");
        verify(passwordEncoder).matches(current72, "old-hash");
        verify(passwordEncoder).encode(new72);
        verify(userRepository).save(user);
        verify(refreshTokenService).revokeAllForUser(77L);
    }

    @Test
    @DisplayName("Kayit: rol yoksa serviste de reddedilir")
    void register_nullRole_rejectedBeforeSave() {
        RegisterRequest req = request(null);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(BusinessRuleException.class);

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Kayit: CANDIDATE rolu kaydedilir")
    void register_candidate_savedWithCandidateRole() {
        RegisterRequest req = request(Role.CANDIDATE);
        when(userRepository.existsByEmail(req.getEmail())).thenReturn(false);

        authService.register(req);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo(Role.CANDIDATE);
        verify(businessRepository, never()).save(any());
    }

    @Test
    @DisplayName("Kayit: BUSINESS_OWNER rolu kaydedilir ve isletme olusturulur")
    void register_businessOwner_savedWithBusiness() {
        RegisterRequest req = request(Role.BUSINESS_OWNER);
        req.setBusinessName("Test Isletme");
        when(userRepository.existsByEmail(req.getEmail())).thenReturn(false);

        authService.register(req);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertThat(captor.getValue().getRole()).isEqualTo(Role.BUSINESS_OWNER);
        verify(businessRepository).save(any());
    }

    @Test
    @DisplayName("Kayit: e-posta kayitliysa hata mesaji/anahtari e-postayi yansitmaz")
    void register_duplicateEmail_doesNotEchoEmail() {
        RegisterRequest req = request(Role.CANDIDATE);
        when(userRepository.existsByEmail(req.getEmail())).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(BusinessRuleException.class)
                .satisfies(e -> {
                    assertThat(((BusinessRuleException) e).getMessageKey()).isEqualTo("error.auth.emailTaken");
                    assertThat(e.getMessage()).doesNotContain(req.getEmail());
                    assertThat(((BusinessRuleException) e).getMessageArgs()).isEmpty();
                });
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Kayit: isletme web sitesi http(s) degilse 422, hicbir sey kaydedilmez")
    void register_business_nonHttpWebsite_rejected() {
        for (String bad : java.util.List.of("javascript:alert(1)", "data:text/html,x", "www.isletmem.com",
                "ftp://isletmem.com", "https://site.com@kotu.example")) {
            RegisterRequest req = request(Role.BUSINESS_OWNER);
            req.setBusinessName("Test Isletme");
            req.setWebsite(bad);
            when(userRepository.existsByEmail(req.getEmail())).thenReturn(false);

            assertThatThrownBy(() -> authService.register(req))
                    .as(bad)
                    .isInstanceOf(BusinessRuleException.class)
                    .extracting(e -> ((BusinessRuleException) e).getMessageKey())
                    .isEqualTo("error.business.websiteInvalid");
        }
        verify(userRepository, never()).save(any());
        verify(businessRepository, never()).save(any());
    }

    @Test
    @DisplayName("Kayit: https web sitesi kirpilip kaydedilir")
    void register_business_httpsWebsite_saved() {
        RegisterRequest req = request(Role.BUSINESS_OWNER);
        req.setBusinessName("Test Isletme");
        req.setWebsite("  https://www.isletmem.com/iletisim  ");
        when(userRepository.existsByEmail(req.getEmail())).thenReturn(false);

        authService.register(req);

        ArgumentCaptor<com.hotelapp.entity.Business> captor =
                ArgumentCaptor.forClass(com.hotelapp.entity.Business.class);
        verify(businessRepository).save(captor.capture());
        assertThat(captor.getValue().getWebsite()).isEqualTo("https://www.isletmem.com/iletisim");
    }

    /** DTO katmani: Bean Validation ile ilk savunma hatti. */
    @Nested
    class RegisterRequestValidation {

        private ValidatorFactory factory;
        private Validator validator;

        @BeforeEach
        void setUp() {
            factory = Validation.buildDefaultValidatorFactory();
            validator = factory.getValidator();
        }

        @AfterEach
        void tearDown() {
            factory.close();
        }

        @Test
        @DisplayName("DTO: role=ADMIN genel 'Geçersiz rol seçimi' mesajiyla reddedilir")
        void adminRole_isInvalid() {
            Set<ConstraintViolation<RegisterRequest>> v = validator.validate(request(Role.ADMIN));

            assertThat(v).hasSize(1);
            ConstraintViolation<RegisterRequest> only = v.iterator().next();
            assertThat(only.getMessage()).isEqualTo("Geçersiz rol seçimi");
            assertThat(only.getMessage()).doesNotContain("ADMIN");
        }

        @Test
        @DisplayName("DTO: CANDIDATE ve BUSINESS_OWNER gecerli")
        void selfRegistrationRoles_areValid() {
            assertThat(validator.validate(request(Role.CANDIDATE))).isEmpty();
            assertThat(validator.validate(request(Role.BUSINESS_OWNER))).isEmpty();
        }

        @Test
        @DisplayName("DTO: rol yoksa yalniz 'Rol seçimi zorunlu' hatasi (cift mesaj yok)")
        void nullRole_onlyNotNullViolation() {
            Set<ConstraintViolation<RegisterRequest>> v = validator.validate(request(null));

            assertThat(v).extracting(ConstraintViolation::getMessage)
                    .containsExactly("Rol seçimi zorunlu");
        }

        @Test
        @DisplayName("DTO: 73 UTF-8 baytlık kayıt parolası reddedilir")
        void overlongPassword_isRejected() {
            RegisterRequest request = request(Role.CANDIDATE);
            request.setPassword("A1" + "a".repeat(71));

            assertThat(validator.validate(request))
                    .anySatisfy(v -> assertThat(v.getMessage()).contains("72 UTF-8"));
        }
    }

    private static RegisterRequest request(Role role) {
        RegisterRequest r = new RegisterRequest();
        r.setTermsAccepted(true);              // KVKK onayi (V27)
        r.setPrivacyNoticeVersion("2026-10-17");
        r.setFullName("Test Kullanici");
        r.setEmail("birim.test@test.com");
        r.setPassword("Test1234");
        r.setRole(role);
        r.setPhone("0555 123 45 67");
        return r;
    }
}
