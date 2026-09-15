package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;

/**
 * Telefon doğrulama (OTP/SMS) — OPSİYONEL. Kayıt akışını bloklamaz; kullanıcı
 * profilinden istediğinde numarasını doğrular ve "doğrulanmış" rozeti kazanır.
 *
 * <p>Kod {@link SmsService} ile gönderilir; SMS DEV MODE iken kod gerçek kullanıcıya
 * gitmez, log'a düşer (Netgsm açılınca uçtan uca çalışır). Bu yüzden zorunlu değil.
 *
 * <p>Freni: 60 sn tekrar-gönder soğuması, 10 dk kod ömrü, 5 yanlış deneme limiti.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PhoneVerificationService {

    private static final int CODE_TTL_MIN        = 10;
    private static final int RESEND_COOLDOWN_SEC = 60;
    private static final int MAX_ATTEMPTS        = 5;

    private final UserRepository userRepository;
    private final SmsService smsService;
    private final SecureRandom random = new SecureRandom();

    public record PhoneStatus(String phone, boolean verified, boolean hasPhone) {}

    @Transactional(readOnly = true)
    public PhoneStatus status(Long userId) {
        User u = getUser(userId);
        boolean hasPhone = u.getPhone() != null && !u.getPhone().isBlank();
        return new PhoneStatus(mask(u.getPhone()), u.isPhoneVerified(), hasPhone);
    }

    @Transactional
    public PhoneStatus sendCode(Long userId) {
        User u = getUser(userId);
        if (u.getPhone() == null || u.getPhone().isBlank())
            throw new BusinessRuleException("Önce profiline telefon numarası ekle.");
        if (u.isPhoneVerified())
            throw new BusinessRuleException("Telefonun zaten doğrulanmış.");
        if (u.getPhoneOtpSentAt() != null
                && u.getPhoneOtpSentAt().isAfter(LocalDateTime.now().minusSeconds(RESEND_COOLDOWN_SEC)))
            throw new BusinessRuleException("Çok sık denedin. Bir dakika sonra tekrar iste.");

        String code = String.format("%06d", random.nextInt(1_000_000));
        u.setPhoneOtpCode(code);
        u.setPhoneOtpExpiresAt(LocalDateTime.now().plusMinutes(CODE_TTL_MIN));
        u.setPhoneOtpSentAt(LocalDateTime.now());
        u.setPhoneOtpAttempts(0);
        userRepository.save(u);

        smsService.send(u.getPhone(),
                "AjansHotel dogrulama kodun: " + code + " (" + CODE_TTL_MIN + " dk gecerli).");
        log.info("[PHONE-OTP] kod gonderildi userId={} (SMS DEV MODE ise koda log'dan bak)", userId);
        return status(userId);
    }

    @Transactional
    public PhoneStatus verify(Long userId, String code) {
        User u = getUser(userId);
        if (u.isPhoneVerified()) return status(userId);
        if (u.getPhoneOtpCode() == null || u.getPhoneOtpExpiresAt() == null)
            throw new BusinessRuleException("Aktif doğrulama kodu yok. Yeni kod iste.");
        if (u.getPhoneOtpExpiresAt().isBefore(LocalDateTime.now()))
            throw new BusinessRuleException("Kodun süresi doldu. Yeni kod iste.");
        if (u.getPhoneOtpAttempts() >= MAX_ATTEMPTS)
            throw new BusinessRuleException("Çok fazla yanlış deneme. Yeni kod iste.");

        String given = (code == null) ? "" : code.trim();
        if (!u.getPhoneOtpCode().equals(given)) {
            u.setPhoneOtpAttempts(u.getPhoneOtpAttempts() + 1);
            userRepository.save(u);
            int left = Math.max(0, MAX_ATTEMPTS - u.getPhoneOtpAttempts());
            throw new BusinessRuleException("Kod hatalı. Kalan deneme: " + left);
        }

        u.setPhoneVerifiedAt(LocalDateTime.now());
        u.setPhoneOtpCode(null);
        u.setPhoneOtpExpiresAt(null);
        u.setPhoneOtpSentAt(null);
        u.setPhoneOtpAttempts(0);
        userRepository.save(u);
        log.info("[PHONE-OTP] dogrulandi userId={}", userId);
        return status(userId);
    }

    private User getUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", id));
    }

    /** Numarayı maskele — sadece son 2 hane. */
    private String mask(String phone) {
        if (phone == null) return null;
        String d = phone.replaceAll("[^0-9]", "");
        if (d.length() < 4) return "•••";
        return "•••• •• " + d.substring(d.length() - 2);
    }
}
