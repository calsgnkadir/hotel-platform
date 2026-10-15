package com.hotelapp.validation;

/**
 * Tek şifre kuralı: kayıt, şifre değiştirme ve şifre sıfırlama aynı kuralı uygular.
 * En az {@value #MIN_LENGTH} karakter + en az 1 harf ve 1 rakam.
 *
 * <p>DTO'larda Bean Validation sabitleri (annotation değerleri derleme zamanı sabiti
 * olmalı) bu sınıftan okunur; servis katmanı {@link #violationKey(String)} ile ikinci
 * kez denetler (DTO doğrulaması atlansa bile zayıf şifre yazılmaz).
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final String PATTERN = "^(?=.*[A-Za-z])(?=.*\\d).+$";
    public static final String MSG_LENGTH = "Şifre en az 8 karakter olmalı";
    public static final String MSG_PATTERN = "Şifre en az 1 harf ve 1 rakam içermeli";

    private static final java.util.regex.Pattern COMPILED = java.util.regex.Pattern.compile(PATTERN);

    private PasswordPolicy() {}

    /** null = kurala uygun; aksi halde i18n mesaj anahtarı. */
    public static String violationKey(String password) {
        if (password == null || password.length() < MIN_LENGTH) return "error.auth.passwordTooShort";
        if (!COMPILED.matcher(password).matches()) return "error.auth.passwordWeak";
        return null;
    }
}
