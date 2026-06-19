package com.hotelapp.service;

import com.hotelapp.dto.AuthResponse;
import com.hotelapp.dto.LoginRequest;
import com.hotelapp.dto.RegisterRequest;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.User;
import com.hotelapp.enums.Role;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.repository.UserRepository;
import com.hotelapp.security.JwtService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final BusinessRepository businessRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;
    private final EmailTemplates emailTemplates;
    private final EmailVerificationService emailVerificationService;

    @Value("${app.base-url:http://localhost:5173}")
    private String baseUrl;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenService refreshTokenService;  // F0.2

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new BusinessRuleException("Bu email adresi zaten kayıtlı: " + request.getEmail());
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .phone(request.getPhone())
                .build();

        userRepository.save(user);

        // F0.2: refresh token üret (cookie'ye konacak)
        String refreshToken = refreshTokenService.createForUser(user);

        if (request.getRole() == Role.BUSINESS_OWNER) {
            Business business = Business.builder()
                    .name(request.getBusinessName())
                    .type(request.getBusinessType())
                    .district(request.getDistrict())
                    .neighborhood(request.getNeighborhood())
                    .address(request.getAddress())
                    .phone(request.getBusinessPhone())
                    .website(request.getWebsite())
                    .description(request.getDescription())
                    .owner(user)
                    .build();
            businessRepository.save(business);
        }

        // FAZ 3 — Welcome email (sessiz fail; register akisini bloklamasin)
        try {
            String dashboardUrl = baseUrl + (request.getRole() == Role.BUSINESS_OWNER ? "/business" : "/candidate");
            String html = emailTemplates.welcome(user.getFullName(), user.getRole().name(), dashboardUrl);
            emailService.queue(user.getEmail(), "AjansHotel'e Hoş Geldin", html);
        } catch (Exception ex) {
            log.warn("[WELCOME-EMAIL] Gonderilemedi (yok sayildi): user={} sebep={}",
                    user.getEmail(), ex.getMessage());
        }

        // FAZ 4.4 — Email dogrulama token'i + mail (sessiz fail)
        try {
            emailVerificationService.sendVerification(user);
        } catch (Exception ex) {
            log.warn("[EMAIL-VERIFY] Initial send failed user={} sebep={}", user.getEmail(), ex.getMessage());
        }

        return AuthResponse.builder()
                .token(jwtService.generateToken(user))
                .refreshToken(refreshToken)
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .emailVerified(user.isEmailVerified())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", request.getEmail()));

        // F0.2: refresh token üret
        String refreshToken = refreshTokenService.createForUser(user);

        return AuthResponse.builder()
                .token(jwtService.generateToken(user))
                .refreshToken(refreshToken)
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .emailVerified(user.isEmailVerified())
                .build();
    }

    /**
     * F0.2 — Refresh token kullanarak yeni access token al.
     * Cookie'den gelen raw token validate edilir + rotate edilir.
     */
    @Transactional
    public AuthResponse refresh(String rawRefreshToken) {
        var result = refreshTokenService.validateAndRotate(rawRefreshToken);
        User user = result.user();
        return AuthResponse.builder()
                .token(jwtService.generateToken(user))
                .refreshToken(result.newRawRefreshToken())
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .emailVerified(user.isEmailVerified())
                .build();
    }

    /** F0.2 — Logout: refresh token revoke */
    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokenService.revoke(rawRefreshToken);
    }

    /**
     * D3: Giriş yapmış kullanıcı şifresini değiştirir.
     * - Mevcut şifre doğrulanır
     * - Yeni şifre eski ile aynı olmamalı
     * - Yeni şifre BCrypt ile hash'lenir
     */
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", userId));

        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
            throw new BusinessRuleException("Mevcut şifre yanlış");
        }
        if (req.getCurrentPassword().equals(req.getNewPassword())) {
            throw new BusinessRuleException("Yeni şifre eskisiyle aynı olamaz");
        }

        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
    }

    @Data
    public static class ChangePasswordRequest {
        @NotBlank(message = "Mevcut şifre zorunlu")
        private String currentPassword;

        @NotBlank(message = "Yeni şifre zorunlu")
        @Size(min = 8, message = "Yeni şifre en az 8 karakter olmalı")
        @jakarta.validation.constraints.Pattern(
            regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
            message = "Şifre en az 1 harf ve 1 rakam içermeli"
        )
        private String newPassword;
    }
}
