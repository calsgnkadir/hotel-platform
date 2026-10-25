package com.hotelapp.security;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * KVKK: uygulama loglarinda kisisel veri (e-posta) tam yazilmaz.
 * Mumkunse log satirinda userId kullanin; kimlik henuz bilinmiyorsa
 * (or. giris denemesi) bu maskeli bicim yazilir.
 */
public final class PiiMasking {

    private PiiMasking() {}

    /** Serbest metindeki e-posta adresleri (JSON/hata metni icinde de yakalanir). */
    private static final Pattern EMAIL_IN_TEXT = Pattern.compile(
            "[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}");

    /**
     * Telefon numarasi adayi: rakamla baslayip biten, arada bosluk/nokta/tire/parantez
     * olabilen dizi. Yalniz 10-13 rakam iceriyorsa maskelenir (tarih/id gibi kisa
     * sayilar dokunulmaz). Ardindan ':' gelen dizi alinmaz ("2026-10-25 12:30" saat degil).
     */
    private static final Pattern PHONE_IN_TEXT = Pattern.compile(
            "(?<![\\w+])\\+?\\(?\\d[\\d\\s().-]{7,}\\d(?![\\w:])");

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

    /**
     * "+90 532 123 45 67" -> "***67". Yalniz son 2 rakam kalir. null -> null;
     * 7'den az rakam -> "***".
     */
    public static String phone(String phone) {
        if (phone == null) return null;
        String digits = phone.replaceAll("\\D", "");
        if (digits.length() < 7) return "***";
        return "***" + digits.substring(digits.length() - 2);
    }

    /** Serbest metindeki tum e-posta adreslerini {@link #email} bicimine cevirir. */
    public static String emailsIn(String text) {
        if (text == null || text.indexOf('@') < 0) return text;
        return EMAIL_IN_TEXT.matcher(text)
                .replaceAll(m -> Matcher.quoteReplacement(email(m.group())));
    }

    /** Serbest metindeki 10-13 haneli telefon numaralarini {@link #phone} bicimine cevirir. */
    public static String phonesIn(String text) {
        if (text == null) return null;
        return PHONE_IN_TEXT.matcher(text).replaceAll(m -> {
            String g = m.group();
            int digits = g.replaceAll("\\D", "").length();
            return Matcher.quoteReplacement(digits >= 10 && digits <= 13 ? phone(g) : g);
        });
    }

    /** Serbest metin (hata mesaji, payload onizlemesi): e-posta + telefon maskelenir. */
    public static String scrub(String text) {
        return phonesIn(emailsIn(text));
    }
}
