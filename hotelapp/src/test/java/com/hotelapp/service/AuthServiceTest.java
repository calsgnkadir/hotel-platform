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
    @InjectMocks private AuthService authService;

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
    }

    private static RegisterRequest request(Role role) {
        RegisterRequest r = new RegisterRequest();
        r.setFullName("Test Kullanici");
        r.setEmail("birim.test@test.com");
        r.setPassword("Test1234");
        r.setRole(role);
        r.setPhone("0555 123 45 67");
        return r;
    }
}
