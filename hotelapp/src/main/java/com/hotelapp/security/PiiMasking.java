package com.hotelapp.security;

/**
 * KVKK: uygulama loglarinda kisisel veri (e-posta) tam yazilmaz.
 * Mumkunse log satirinda userId kullanin; kimlik henuz bilinmiyorsa
 * (or. giris denemesi) bu maskeli bicim yazilir.
 */
public final class PiiMasking {

    private PiiMasking() {}

    /**
     * "ayse@ornek.com" -> "a***@o***.com". Yerel kisim ve alan adi ilk harf disinda gizlenir,
     * yalniz son uzanti (".com", ".tr") kalir. null -> null; bicimsiz deger -> "***".
     */
    public static String email(String email) {
        if (email == null) return null;
        String e = email.trim();
        int at = e.indexOf('@');
        if (at <= 0 || at == e.length() - 1 || e.indexOf('@', at + 1) >= 0) return "***";
        String domain = e.substring(at + 1);
        int dot = domain.lastIndexOf('.');
        String maskedDomain = (dot <= 0)
                ? domain.charAt(0) + "***"
                : domain.charAt(0) + "***" + domain.substring(dot);
        return e.charAt(0) + "***@" + maskedDomain;
    }
}
