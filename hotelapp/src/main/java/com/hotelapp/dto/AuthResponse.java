package com.hotelapp.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.hotelapp.enums.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class AuthResponse {
    /** Kısa ömürlü access JWT (15 dakika) — frontend Authorization header'da yollar */
    private String token;

    /**
     * F0.2 — Refresh token (uzun ömürlü, 7 gün).
     * NOT: Bu field controller seviyesinde cookie'ye konulup body'den ÇIKARILIR
     * (JsonInclude.NON_NULL ile null geldiğinde JSON'a girmez).
     * Frontend bunu HİÇ görmemeli, cookie üzerinden tarayıcı otomatik yönetir.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String refreshToken;

    private Long userId;
    private String email;
    private String fullName;
    private Role role;
}
