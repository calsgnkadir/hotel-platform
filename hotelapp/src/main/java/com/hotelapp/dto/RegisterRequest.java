package com.hotelapp.dto;

import com.hotelapp.enums.BusinessType;
import com.hotelapp.enums.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {

    @NotBlank(message = "Ad soyad zorunlu")
    private String fullName;

    @Email(message = "Geçerli bir email girin")
    @NotBlank
    private String email;

    @Size(min = 8, message = "Şifre en az 8 karakter olmalı")
    private String password;

    @NotNull(message = "Rol seçimi zorunlu")
    private Role role; // CANDIDATE or BUSINESS_OWNER

    private String phone;

    // --- CANDIDATE fields ---
    // UI checkbox "Üniversite öğrencisiyim" — not verified, just a self-declaration flag
    private boolean studentSelf = false;

    // --- BUSINESS_OWNER fields ---
    private String businessName;
    private BusinessType businessType;
    private String district;
    private String address;
    private String businessPhone;
    private String website;
    private String description;
}
