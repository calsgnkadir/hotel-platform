package com.hotelapp.service;

import com.hotelapp.entity.User;
import com.hotelapp.exception.EmailNotVerifiedException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Kritik işlemler (işletme: ilan oluşturma/yayına alma; aday: başvuru; iki taraf:
 * sohbet başlatma) yalnız e-postası doğrulanmış hesapla yapılır → aksi halde 403
 * {@code EMAIL_NOT_VERIFIED}. Google hesapları doğrulanmış sayılır
 * ({@link User#isEmailVerified()}).
 *
 * <p>{@code app.auth.require-verified-email} varsayılan true (prod). dev ve test
 * profillerinde false: CI'daki E2E akışında yeni kayıt olan aday e-posta doğrulamadan
 * başvurur.
 */
@Component
public class EmailVerificationPolicy {

    private final boolean required;

    public EmailVerificationPolicy(@Value("${app.auth.require-verified-email:true}") boolean required) {
        this.required = required;
    }

    /** Birim testleri için: zorunluluk kapalı politika. */
    public static EmailVerificationPolicy disabled() {
        return new EmailVerificationPolicy(false);
    }

    public boolean isRequired() {
        return required;
    }

    public void requireVerified(User user) {
        if (required && user != null && !user.isEmailVerified()) {
            throw new EmailNotVerifiedException();
        }
    }
}
