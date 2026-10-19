package com.hotelapp.security;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * Hiçbir kullanıcının bilemeyeceği, kullanılamaz BCrypt parola özeti.
 *
 * <p>{@code users.password} NOT NULL (V1): parolası olmaması gereken hesaplar
 * (KVKK anonimleştirmesi, Google ile oluşturulan hesap, doğrulanmamış LOCAL hesabın
 * Google'a bağlanması) null yerine bunu alır. Girdi 256 bit rastgele ve hiçbir yere
 * kaydedilmez; özet uygulamanın BCrypt kodlayıcısıyla uyumludur ("şifremi unuttum"
 * ile kullanıcı yeni parola belirleyebilir).
 */
public final class UnusablePassword {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder();

    private UnusablePassword() {}

    public static String newHash() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return ENCODER.encode("UNUSABLE-" + Base64.getEncoder().encodeToString(bytes));
    }
}
