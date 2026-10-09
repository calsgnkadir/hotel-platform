package com.hotelapp.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.Role;
import com.hotelapp.validation.TurkeyPhone;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.EnumSet;
import java.util.Set;

@Data
public class RegisterRequest {

    @NotBlank(message = "Ad soyad zorunlu")
    private String fullName;

    @Email(message = "Geçerli bir email girin")
    @NotBlank
    private String email;

    /**
     * FAZ 4.4 — Sifre politikasi:
     *   - En az 8 karakter
     *   - En az 1 harf (a-zA-Z) + en az 1 rakam (0-9)
     */
    @Size(min = 8, message = "Şifre en az 8 karakter olmalı")
    @Pattern(
        regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
        message = "Şifre en az 1 harf ve 1 rakam içermeli"
    )
    private String password;

    @NotNull(message = "Rol seçimi zorunlu")
    private Role role; // CANDIDATE or BUSINESS_OWNER

    /** Kişisel telefon — mobil bekliyoruz (5XX...). */
    @TurkeyPhone(mobileOnly = true, message = "Geçerli bir cep telefonu girin (örn: 0555 123 45 67)")
    private String phone;

    // --- CANDIDATE fields ---
    // UI checkbox "Üniversite öğrencisiyim" — not verified, just a self-declaration flag
    private boolean studentSelf = false;

    // --- BUSINESS_OWNER fields ---
    private String businessName;
    private BusinessType businessType;
    private String district;
    private String neighborhood;
    private String address;

    /** İşletme telefonu — mobil veya sabit hat (0212/0216/...) ikisi de kabul. */
    @TurkeyPhone(message = "Geçerli bir telefon numarası girin (örn: 0212 555 12 34)")
    private String businessPhone;

    private String website;
    private String description;

    /** Kendi kendine kayitta secilebilecek roller. ADMIN asla buradan atanmaz. */
    public static final Set<Role> SELF_REGISTRATION_ROLES =
            Set.copyOf(EnumSet.of(Role.CANDIDATE, Role.BUSINESS_OWNER));

    /**
     * Guvenlik: istemci "role":"ADMIN" gonderse bile kayit reddedilir.
     * null durumu @NotNull'a birakilir (cift mesaj olmasin).
     * Mesaj genel tutulur; hangi rollerin var oldugu ifsa edilmez.
     */
    @JsonIgnore
    @AssertTrue(message = "Geçersiz rol seçimi")
    public boolean isRoleAllowedForSelfRegistration() {
        return role == null || SELF_REGISTRATION_ROLES.contains(role);
    }
}
