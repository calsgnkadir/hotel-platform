package com.hotelapp.service;

import com.hotelapp.entity.PasswordResetToken;
import com.hotelapp.entity.User;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.repository.PasswordResetTokenRepository;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * #80: Şifre sıfırlama iş akışı.
 *
 * 3 aşama:
 *   - request(email)              → token oluştur + email gönder (sessiz, email yoksa exception fırlatma)
 *   - validate(token)             → token geçerli mi (UI'da formu açmadan önce kontrol)
 *   - confirm(token, newPassword) → şifreyi güncelle + token'ı işaretle
 *
 * Güvenlik:
 *   - Email bilinmeyen olsa bile request endpoint'i 200 döner (enumeration saldırısını engeller)
 *   - Token UUID (128 bit entropi)
 *   - Tek kullanımlık (usedAt) + 1 saat süre
 *   - Yeni request → eski açık token'lar otomatik invalidate
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.base-url:http://localhost:5173}")
    private String appBaseUrl;

    @Value("${app.email.password-reset.expiry-hours:1}")
    private int expiryHours;

    /**
     * Email ile şifre sıfırlama talebi başlatır.
     * Bilinmeyen email için bile sessiz 200 (security best practice).
     */
    @Transactional
    public void requestReset(String email) {
        Optional<User> userOpt = userRepository.findByEmail(email.toLowerCase().trim());
        if (userOpt.isEmpty()) {
            log.info("[PWD-RESET] Bilinmeyen email talebi: {} (sessiz başarı döndü)", email);
            return;  // sessiz başarı — saldırgan kullanıcı listesi çıkaramaz
        }

        User user = userOpt.get();

        // Önceki açık token'ları kapat (sadece son link çalışsın)
        tokenRepository.invalidateAllActiveForUser(user.getId(), LocalDateTime.now());

        // Yeni token oluştur
        String token = UUID.randomUUID().toString().replace("-", "");
        PasswordResetToken prt = PasswordResetToken.builder()
                .token(token)
                .user(user)
                .expiresAt(LocalDateTime.now().plusHours(expiryHours))
                .build();
        tokenRepository.save(prt);

        // Email gönder — başarısız olsa bile token aktif kalır
        String resetLink = appBaseUrl + "/reset-password?token=" + token;
        String html = emailService.buildPasswordResetHtml(user.getFullName(), resetLink);
        try {
            emailService.queue(user.getEmail(), "AjansHotel — Şifre Sıfırlama", html);
            // FAZ 9.6 — Link INFO seviyeden DEBUG'a: prod log'larinda reset link sizmaz.
            // Dev'de logging.level ayari ile gorulebilir.
            log.info("[PWD-RESET] Token oluşturuldu + email gönderildi: userId={}", user.getId());
            log.debug("[PWD-RESET] Reset link: {}", resetLink);
        } catch (Exception e) {
            // Resend ücretsiz tier'da yalnızca hesabına bağlı email'lere izin verir.
            // FAZ 9.6 — Link WARN'dan DEBUG'a: prod log'larinda hata anindaki link de sizmaz.
            log.warn("[PWD-RESET] Email gönderilemedi (Resend hatası) userId={} ama token aktif. Sebep: {}",
                    user.getId(), e.getMessage());
            log.debug("[PWD-RESET] >>> {}", resetLink);
            // Sessiz başarı — UI'da "gönderildi" görünmeli ki kullanıcı süreçten haberdar olsun.
            // Gerçek hata sadece log'da görünür (security + UX dengesi).
        }
    }

    /**
     * Token'ı doğrular (UI'da reset formunu render etmeden önce çağrılır).
     * @return user'ın email'i (UI'da "bu email için şifre değiştir" şeklinde gösterilebilir)
     */
    @Transactional(readOnly = true)
    public String validateToken(String token) {
        PasswordResetToken prt = tokenRepository.findByToken(token)
                .orElseThrow(() -> new BusinessRuleException("Geçersiz veya kullanılmış bağlantı."));

        if (prt.isUsed()) {
            throw new BusinessRuleException("Bu bağlantı zaten kullanılmış. Yeni bir talep oluşturun.");
        }
        if (prt.isExpired()) {
            throw new BusinessRuleException("Bu bağlantının süresi dolmuş. Yeni bir talep oluşturun.");
        }
        return prt.getUser().getEmail();
    }

    /** Token + yeni şifre ile sıfırlamayı tamamlar. */
    @Transactional
    public void confirmReset(String token, String newPassword) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new BusinessRuleException("Şifre en az 8 karakter olmalıdır.");
        }

        PasswordResetToken prt = tokenRepository.findByToken(token)
                .orElseThrow(() -> new BusinessRuleException("Geçersiz veya kullanılmış bağlantı."));

        if (prt.isUsed()) {
            throw new BusinessRuleException("Bu bağlantı zaten kullanılmış. Yeni bir talep oluşturun.");
        }
        if (prt.isExpired()) {
            throw new BusinessRuleException("Bu bağlantının süresi dolmuş. Yeni bir talep oluşturun.");
        }

        // Şifreyi güncelle
        User user = prt.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Token'ı tek-kullanımlık olarak işaretle
        prt.setUsedAt(LocalDateTime.now());
        tokenRepository.save(prt);

        log.info("[PWD-RESET] Şifre güncellendi: userId={}", user.getId());
    }
}
