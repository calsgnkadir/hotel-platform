package com.hotelapp.enums;

/**
 * #92: Kullanıcının hesabını oluşturduğu kimlik sağlayıcı.
 * - LOCAL: email + şifre ile manuel kayıt
 * - GOOGLE: Google OAuth ile giriş
 */
public enum AuthProvider {
    LOCAL,
    GOOGLE,
}
