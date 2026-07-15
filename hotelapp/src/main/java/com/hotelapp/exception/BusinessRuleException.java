package com.hotelapp.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * İş kuralı ihlalinde fırlatılır → HTTP 422 Unprocessable Entity
 * Örnek: aynı otele çift başvuru, sonuçlanmış başvuruya karar verme,
 *        süresi dolmuş başvuru, geçersiz durum geçişi
 *
 * FAZ 12 — i18n: keyed(...) factory ile message key tasinabilir; legacy
 * String constructor (hardcoded Turkce) geriye donuk uyumlu kalir.
 */
@ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
public class BusinessRuleException extends RuntimeException implements LocalizedException {

    private final String messageKey;
    private final transient Object[] messageArgs;

    /** Legacy — hardcoded Turkce mesaj (i18n cozumlemesi yapilmaz). */
    public BusinessRuleException(String message) {
        super(message);
        this.messageKey = null;
        this.messageArgs = null;
    }

    private BusinessRuleException(String key, Object[] args) {
        super(key);  // fallback = key (MessageSource cozemezse gorulur)
        this.messageKey = key;
        this.messageArgs = args;
    }

    /** FAZ 12 — i18n: message key + args. Accept-Language'a gore cozulur. */
    public static BusinessRuleException keyed(String key, Object... args) {
        return new BusinessRuleException(key, args);
    }

    @Override public String getMessageKey() { return messageKey; }
    @Override public Object[] getMessageArgs() { return messageArgs == null ? new Object[0] : messageArgs; }
}
