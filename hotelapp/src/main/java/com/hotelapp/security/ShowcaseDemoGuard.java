package com.hotelapp.security;

import com.hotelapp.exception.UnauthorizedException;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Vitrin (showcase) profili herkese açık demo hesaplarla çalışır (DemoSeeder:
 * demo-adayN@test.com / demo-isletmeN@test.com, ortak şifre). Bir ziyaretçi bu
 * hesapların şifresini değiştirir ya da hesabı silerse vitrin diğer herkes için
 * kırılır. Bu yüzden showcase'te demo hesaplarda şifre değişikliği ve hesap silme
 * reddedilir (403). Showcase dışındaki profillerde ve demo olmayan hesaplarda
 * hiçbir etkisi yoktur.
 */
@Component
public class ShowcaseDemoGuard {

    /** DemoSeeder'ın ürettiği e-postalar. */
    static final Pattern DEMO_EMAIL = Pattern.compile("^demo-(aday|isletme)\\d+@test\\.com$");

    private final boolean showcase;

    public ShowcaseDemoGuard(Environment env) {
        this.showcase = env.acceptsProfiles(Profiles.of("showcase"));
    }

    public static boolean isDemoEmail(String email) {
        return email != null && DEMO_EMAIL.matcher(email.trim().toLowerCase(Locale.ROOT)).matches();
    }

    /** Vitrinde demo hesabı ise 403 (Türkçe); aksi halde hiçbir şey yapmaz. */
    public void requireMutable(String email) {
        if (showcase && isDemoEmail(email)) {
            throw UnauthorizedException.keyed("error.showcase.demoAccountLocked");
        }
    }
}
