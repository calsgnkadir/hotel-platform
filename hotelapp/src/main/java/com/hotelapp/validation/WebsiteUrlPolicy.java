package com.hotelapp.validation;

import com.hotelapp.exception.BusinessRuleException;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

/**
 * İşletme web sitesi adresi: yalnız {@code http://} veya {@code https://}.
 *
 * <p>Adres herkese açık işletme sayfasında bağlantı olarak gösterilir;
 * {@code javascript:}, {@code data:} vb. şemalar tıklanınca betik çalıştırabilirdi.
 * Boş değer "web sitesi yok" demektir ({@code null} saklanır).
 */
public final class WebsiteUrlPolicy {

    /** Business.website sütunu varsayılan VARCHAR(255). */
    static final int MAX_LENGTH = 255;

    private WebsiteUrlPolicy() {}

    /**
     * @return kırpılmış adres ya da boşsa {@code null}
     * @throws BusinessRuleException (422) şema http/https değilse, host yoksa ya da adres bozuksa
     */
    public static String normalizeOrReject(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        if (!isAllowed(value)) {
            throw BusinessRuleException.keyed("error.business.websiteInvalid");
        }
        return value;
    }

    public static boolean isAllowed(String value) {
        if (value == null || value.length() > MAX_LENGTH) return false;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isWhitespace(c) || Character.isISOControl(c)) return false;
        }
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            if (scheme == null) return false;
            String s = scheme.toLowerCase(Locale.ROOT);
            if (!s.equals("http") && !s.equals("https")) return false;
            // Kullanıcı bilgisi (https://site.com@kotu.example) yanıltıcı — reddet
            if (uri.getRawUserInfo() != null) return false;
            String host = uri.getHost();
            return host != null && !host.isBlank();
        } catch (URISyntaxException e) {
            return false;
        }
    }
}
