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

    /** İş kuralı saati: Türkiye yerel saati, JVM saat diliminden bağımsız (testte sabitlenebilir). */
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

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
    private final PushSubscriptionService pushSubscriptionService;
    private final com.hotelapp.security.LoginAttemptLimiter loginAttemptLimiter;
    private final com.hotelapp.security.oauth.OAuthLoginCodeStore oAuthLoginCodeStore;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // Guvenlik (ikinci katman): DTO dogrulamasi atlansa bile ADMIN vb. roller
        // kendi kendine kayitla atanamaz. Kayittan once reddedilir; mesaj genel.
        if (request.getRole() == null
                || !RegisterRequest.SELF_REGISTRATION_ROLES.contains(request.getRole())) {
            log.warn("[REGISTER] Izin verilmeyen rol ile kayit denemesi reddedildi");
            throw new BusinessRuleException("Geçersiz rol seçimi");
        }

        if (userRepository.existsByEmail(request.getEmail())) {
            // Girilen e-posta yanıtta/logda yansıtılmaz
            throw BusinessRuleException.keyed("error.auth.emailTaken");
        }
        // İkinci katman: DTO doğrulaması atlansa bile zayıf şifre yazılmaz
        String pwViolation = com.hotelapp.validation.PasswordPolicy.violationKey(request.getPassword());
        if (pwViolation != null) {
            throw BusinessRuleException.keyed(pwViolation);
        }
        // KVKK onayı: kabul edilmeden ve sürüm bilinmeden hesap açılmaz (422)
        if (!Boolean.TRUE.equals(request.getTermsAccepted())) {
            throw new BusinessRuleException(TERMS_REQUIRED);
        }
        String noticeVersion = normalizeNoticeVersion(request.getPrivacyNoticeVersion());
        if (noticeVersion == null) {
            throw new BusinessRuleException(NOTICE_VERSION_REQUIRED);
        }
        // İşletme web sitesi yalnız http(s) — herkese açık sayfada bağlantı olarak gösterilir
        String website = request.getRole() == Role.BUSINESS_OWNER
                ? com.hotelapp.validation.WebsiteUrlPolicy.normalizeOrReject(request.getWebsite())
                : null;

        User user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .phone(request.getPhone())
                .build();
        recordConsent(user, noticeVersion);

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
                    .website(website)
                    .description(request.getDescription())
                    .owner(user)
                    .build();
            businessRepository.save(business);
        }

        // FAZ 3 — Welcome email (sessiz fail; register akisini bloklamasin)
        try {
            String dashboardUrl = baseUrl + (request.getRole() == Role.BUSINESS_OWNER ? "/business" : "/candidate");
            String html = emailTemplates.welcome(user.getFullName(), user.getRole().name(), dashboardUrl);
            emailService.queue(user.getEmail(), "Kadrom'a Hoş Geldin", html);
        } catch (Exception ex) {
            log.warn("[WELCOME-EMAIL] Gonderilemedi (yok sayildi): userId={} sebep={}",
                    user.getId(), ex.getMessage());
        }

        // FAZ 4.4 — Email dogrulama token'i + mail (sessiz fail)
        try {
            emailVerificationService.sendVerification(user);
        } catch (Exception ex) {
            log.warn("[EMAIL-VERIFY] Initial send failed userId={} sebep={}", user.getId(), ex.getMessage());
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

    /**
     * @param clientIp istemci IP'si (request.getRemoteAddr(); RemoteIpValve gercek IP'yi cozer).
     *                 Deneme siniri e-posta+IP anahtarli: saldirgan baska IP'deki gercek
     *                 kullaniciyi kilitleyemez.
     */
    public AuthResponse login(LoginRequest request, String clientIp) {
        if (!com.hotelapp.validation.PasswordPolicy.isWithinBcryptLimit(request.getPassword())) {
            throw BusinessRuleException.keyed("error.auth.passwordTooLong");
        }
        // (e-posta + IP) basina deneme siniri; hesap var/yok fark etmez
        if (!loginAttemptLimiter.tryAcquire(request.getEmail(), clientIp)) {
            throw new com.hotelapp.exception.TooManyRequestsException(
                    "Bu hesap için çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.");
        }
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );
        } catch (org.springframework.security.authentication.LockedException ex) {
            // Buraya yalniz DOGRU sifreyle gelinir (hesap durumu post-auth denetlenir):
            // kullanici kendi ban bitisini gorebilir. Yanlis sifre BadCredentials olur.
            java.time.LocalDateTime until = userRepository.findByEmail(request.getEmail())
                    .map(User::getBannedUntil).orElse(null);
            throw new com.hotelapp.exception.AccountSuspendedException(until);
        } catch (org.springframework.security.core.AuthenticationException ex) {
            // Dagitik deneme izleme (yalniz log; kilitlemez)
            loginAttemptLimiter.recordFailure(request.getEmail());
            throw ex;
        }
        // Basarili giris: tuketilen hak iade (yalniz basarisiz denemeler sayilir)
        loginAttemptLimiter.reset(request.getEmail(), clientIp);

        User user = userRepository.findByEmail(request.getEmail())
                // KVKK: e-posta istisna mesajina/loga girmesin
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı."));

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
     * Google girişi dönüşü: tek kullanımlık kodu erişim token'ı + refresh token'a çevirir.
     * Kod geçersiz/süresi dolmuş/kullanılmışsa ya da hesap bu arada kapatıldıysa 422
     * (401 değil: frontend 401'de oturum yenilemeye çalışır).
     */
    @Transactional
    public AuthResponse exchangeOAuthCode(String code) {
        return exchangeOAuthCode(code, null, null);
    }

    /**
     * KVKK: hesabın onay kaydı yoksa (Google ile ilk kez oluşan hesap ya da V27 öncesi
     * hesap) termsAccepted=true + privacyNoticeVersion zorunludur; yoksa 422
     * {@code CONSENT_REQUIRED} döner ve kod TÜKETİLMEZ — frontend onay kutusunu
     * gösterip aynı kodla (60 sn içinde) tekrar dener. Onay geldiyse yeni sürüm kaydedilir.
     */
    @Transactional
    public AuthResponse exchangeOAuthCode(String code, Boolean termsAccepted, String privacyNoticeVersion) {
        Long userId = oAuthLoginCodeStore.peek(code)
                .orElseThrow(() -> BusinessRuleException.keyed("error.auth.oauthCodeInvalid"));
        User user = userRepository.findById(userId).orElse(null);
        boolean banned = user != null && user.getBannedUntil() != null
                && user.getBannedUntil().isAfter(java.time.LocalDateTime.now(clock));
        if (user == null || !user.isEnabled() || banned) {
            oAuthLoginCodeStore.consume(code);
            log.warn("[OAUTH] Kapalı/yasaklı hesap için kod değişimi reddedildi: userId={}", userId);
            throw BusinessRuleException.keyed("error.auth.oauthCodeInvalid");
        }
        String noticeVersion = normalizeNoticeVersion(privacyNoticeVersion);
        boolean consentGiven = Boolean.TRUE.equals(termsAccepted) && noticeVersion != null;
        if (user.getTermsAcceptedAt() == null && !consentGiven) {
            throw new com.hotelapp.exception.ConsentRequiredException();   // kod geçerli kalır
        }
        // Kod atomik tüketilir: aynı kodla eşzamanlı ikinci istek burada düşer
        if (oAuthLoginCodeStore.consume(code).isEmpty()) {
            throw BusinessRuleException.keyed("error.auth.oauthCodeInvalid");
        }
        if (consentGiven) {
            recordConsent(user, noticeVersion);
            userRepository.save(user);
        }
        return AuthResponse.builder()
                .token(jwtService.generateToken(user))
                .refreshToken(refreshTokenService.createForUser(user))
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .emailVerified(user.isEmailVerified())
                .build();
    }

    static final String TERMS_REQUIRED = "Kullanım Şartları kabul edilmeli.";
    static final String NOTICE_VERSION_REQUIRED = "Aydınlatma Metni sürümü eksik ya da geçersiz.";
    private static final java.util.regex.Pattern NOTICE_VERSION = java.util.regex.Pattern.compile("[A-Za-z0-9._-]{1,32}");

    /** Sürüm metni: boş/uzun/garip karakterliyse null (çağıran 422/CONSENT_REQUIRED döner). */
    static String normalizeNoticeVersion(String v) {
        if (v == null) return null;
        String t = v.trim();
        return NOTICE_VERSION.matcher(t).matches() ? t : null;
    }

    /** Kullanım Şartları kabulü + Aydınlatma Metni sürüm onayı (şimdi). */
    private static void recordConsent(User user, String noticeVersion) {
        java.time.LocalDateTime now = java.time.LocalDateTime.now(java.time.ZoneId.of("Europe/Istanbul"));
        user.setTermsAcceptedAt(now);
        user.setPrivacyNoticeVersion(noticeVersion);
        user.setPrivacyNoticeAckAt(now);
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

    /**
     * F0.2 — Logout: refresh token revoke.
     * Tarayıcının push adresi geldiyse o cihazdaki abonelik bu kullanıcıdan koparılır
     * (ortak telefonda bir sonraki kişiye bildirim gitmesin). Kullanıcı refresh
     * token'dan bulunur; erişim token'ının süresi dolmuş olsa da çalışır.
     */
    @Transactional
    public void logout(String rawRefreshToken, String pushEndpoint) {
        refreshTokenService.revoke(rawRefreshToken)
                .ifPresent(userId -> pushSubscriptionService.unsubscribe(userId, pushEndpoint));
    }

    /**
     * D3: Giriş yapmış kullanıcı şifresini değiştirir.
     * - Mevcut şifre doğrulanır
     * - Yeni şifre eski ile aynı olmamalı
     * - Yeni şifre BCrypt ile hash'lenir
     */
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest req) {
        if (!com.hotelapp.validation.PasswordPolicy.isWithinBcryptLimit(req.getCurrentPassword())) {
            throw BusinessRuleException.keyed("error.auth.passwordTooLong");
        }
        String violation = com.hotelapp.validation.PasswordPolicy.violationKey(req.getNewPassword());
        if (violation != null) throw BusinessRuleException.keyed(violation);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", userId));

        if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPassword())) {
            throw BusinessRuleException.keyed("error.auth.currentPasswordWrong");
        }
        if (req.getCurrentPassword().equals(req.getNewPassword())) {
            throw BusinessRuleException.keyed("error.auth.passwordSame");
        }

        user.setPassword(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);

        // Guvenlik: sifre degisince mevcut tum oturumlari (refresh token) iptal et
        // (calinan/eski oturumlar gecerli kalmasin).
        refreshTokenService.revokeAllForUser(userId);
    }

    @Data
    public static class ChangePasswordRequest {
        @NotBlank(message = "Mevcut şifre zorunlu")
        @com.hotelapp.validation.PasswordMaxBytes
        private String currentPassword;

        @NotBlank(message = "Yeni şifre zorunlu")
        @com.hotelapp.validation.PasswordMaxBytes
        @Size(min = com.hotelapp.validation.PasswordPolicy.MIN_LENGTH,
              message = "Yeni şifre en az 8 karakter olmalı")
        @jakarta.validation.constraints.Pattern(
            regexp = com.hotelapp.validation.PasswordPolicy.PATTERN,
            message = com.hotelapp.validation.PasswordPolicy.MSG_PATTERN
        )
        private String newPassword;
    }
}
