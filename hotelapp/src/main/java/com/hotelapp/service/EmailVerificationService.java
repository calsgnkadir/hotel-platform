package com.hotelapp.service;

import com.hotelapp.entity.EmailVerificationToken;
import com.hotelapp.entity.User;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.EmailVerificationTokenRepository;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * FAZ 4.4 — Email dogrulama is akisi (PasswordResetService pattern).
 *
 *   - sendVerification(user)   → token olustur + email gonder. Onceki token'lari iptal eder.
 *   - verify(token)            → token'i tuket + user.emailVerifiedAt = now.
 *
 * Email gondermesi sessiz fail (Resend ucretsiz tier limit, vs.) — token DB'de kalir,
 * kullanici "tekrar gonder" diyebilir.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmailVerificationService {

    private final UserRepository userRepository;
    private final EmailVerificationTokenRepository tokenRepository;
    private final EmailService emailService;
    private final EmailTemplates emailTemplates;

    @Value("${app.base-url:http://localhost:5173}")
    private String appBaseUrl;

    @Value("${app.email.verification.expiry-hours:24}")
    private int expiryHours;

    /** Yeni token olustur + verification email gonder. Onceki token'lar invalidate edilir. */
    @Transactional
    public void sendVerification(User user) {
        if (user.isEmailVerified()) {
            log.info("[EMAIL-VERIFY] user={} zaten dogrulanmis, mail gondermeye gerek yok", user.getId());
            return;
        }

        tokenRepository.invalidateAllActiveForUser(user.getId(), LocalDateTime.now());

        String token = UUID.randomUUID().toString().replace("-", "");
        EmailVerificationToken evt = EmailVerificationToken.builder()
                .token(token)
                .user(user)
                .expiresAt(LocalDateTime.now().plusHours(expiryHours))
                .build();
        tokenRepository.save(evt);

        String verifyLink = appBaseUrl + "/verify-email?token=" + token;
        try {
            String html = emailTemplates.verifyEmail(user.getFullName(), verifyLink);
            emailService.queue(user.getEmail(), "AjansHotel — Email Doğrulama", html);
            // FAZ 9.6 — Link INFO seviyeden DEBUG'a: prod log'larinda verify link sizmaz.
            log.info("[EMAIL-VERIFY] Token olusturuldu + mail gonderildi: userId={}", user.getId());
            log.debug("[EMAIL-VERIFY] Verify link: {}", verifyLink);
        } catch (Exception e) {
            // FAZ 9.6 — Link WARN'dan DEBUG'a: hata anindaki link de sizmaz.
            log.warn("[EMAIL-VERIFY] Mail gonderilemedi userId={}. Sebep: {}",
                    user.getId(), e.getMessage());
            log.debug("[EMAIL-VERIFY] >>> {}", verifyLink);
        }
    }

    /** Token'i tuket + user.emailVerifiedAt set et. */
    @Transactional
    public void verify(String token) {
        EmailVerificationToken evt = tokenRepository.findByToken(token)
                .orElseThrow(() -> new BusinessRuleException("Geçersiz veya kullanılmış bağlantı."));

        if (evt.isUsed()) {
            throw new BusinessRuleException("Bu bağlantı zaten kullanılmış.");
        }
        if (evt.isExpired()) {
            throw new BusinessRuleException("Bu bağlantının süresi dolmuş. Tekrar gönderme talebi oluştur.");
        }

        User user = evt.getUser();
        if (!user.isEmailVerified()) {
            user.setEmailVerifiedAt(LocalDateTime.now());
            userRepository.save(user);
        }

        evt.setUsedAt(LocalDateTime.now());
        tokenRepository.save(evt);

        log.info("[EMAIL-VERIFY] Email dogrulandi: userId={}", user.getId());
    }
}
