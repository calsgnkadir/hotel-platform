package com.hotelapp.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * {@link TurkeyPhone} için gerçek doğrulama mantığı.
 * Boşluk/tire/parantez/+90'ı kaldırıp 10 hane olduğunda alanın doğruluğu kontrol edilir.
 */
public class TurkeyPhoneValidator implements ConstraintValidator<TurkeyPhone, String> {

    private boolean mobileOnly;

    @Override
    public void initialize(TurkeyPhone annotation) {
        this.mobileOnly = annotation.mobileOnly();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // Null ve boş geçerli — opsiyonel alan
        if (value == null || value.isBlank()) return true;

        // Sadece rakamları al (+90, 0, boşluk, tire, parantez temizlenir)
        String digits = value.replaceAll("\\D", "");

        // Başındaki ülke kodu (90) ve şehir kodu/operatör başlangıcındaki 0'ı normalize et
        // 0555... -> 555...
        // 90555... -> 555...
        // 905555... -> 5555...
        if (digits.length() == 12 && digits.startsWith("90")) {
            digits = digits.substring(2);
        } else if (digits.length() == 13 && digits.startsWith("90")) {
            // Çok haneli, geçersiz (ülke kodu + 11 hane)
            return false;
        }
        if (digits.length() == 11 && digits.startsWith("0")) {
            digits = digits.substring(1);
        }

        // Normalize sonrası 10 hane bekliyoruz
        if (digits.length() != 10) return false;

        // İlk karakter operatör/şehir kodu — 1-9 arası anlamlı
        char firstDigit = digits.charAt(0);
        if (firstDigit < '1' || firstDigit > '9') return false;

        // mobileOnly = true ise normalize sonrası ilk hane 5 olmalı (Türkiye mobil)
        if (mobileOnly && firstDigit != '5') return false;

        return true;
    }
}
