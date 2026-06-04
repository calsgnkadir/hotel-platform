package com.hotelapp.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Türkiye telefon numarası doğrulaması.
 * Boşluk/tire/parantez/+90 toleranslı.
 *
 * Kabul edilen formatlar (normalize ettikten sonra):
 *  - 10 hane:  5XXXXXXXXX (mobil) veya 2XXXXXXXXX (sabit, İstanbul 0212/0216 vb.)
 *  - 11 hane:  0XXXXXXXXXX (başında 0)
 *  - 12-13 hane: 90XXXXXXXXXX (uluslararası, başında 90 ya da +90)
 *
 * {@code mobileOnly = true} ise normalize sonrası numara 5 ile başlamalı (mobil).
 * {@code mobileOnly = false} (default) ise mobil ve sabit hat ikisi de kabul.
 *
 * Null ve boş string geçerli sayılır — alan opsiyonel ise kullanıcı boş bırakabilsin.
 * Zorunlu yapmak için @NotBlank ile birlikte kullan.
 */
@Documented
@Constraint(validatedBy = TurkeyPhoneValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface TurkeyPhone {

    String message() default "Geçerli bir telefon numarası girin (örn: 0555 123 45 67)";

    boolean mobileOnly() default false;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
