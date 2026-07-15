package com.hotelapp.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Kaynak var ama bu kullanıcıya ait değil → HTTP 403
 * Örnek: başka öğrencinin belgesini silmeye çalışmak,
 *        başka otelin başvurusuna karar vermeye çalışmak
 *
 * FAZ 12 — i18n: keyed(...) factory ile message key tasinabilir; legacy
 * String constructor geriye donuk uyumlu.
 */
@ResponseStatus(HttpStatus.FORBIDDEN)
public class UnauthorizedException extends RuntimeException implements LocalizedException {

    private final String messageKey;
    private final transient Object[] messageArgs;

    public UnauthorizedException(String message) {
        super(message);
        this.messageKey = null;
        this.messageArgs = null;
    }

    private UnauthorizedException(String key, Object[] args) {
        super(key);
        this.messageKey = key;
        this.messageArgs = args;
    }

    public static UnauthorizedException keyed(String key, Object... args) {
        return new UnauthorizedException(key, args);
    }

    @Override public String getMessageKey() { return messageKey; }
    @Override public Object[] getMessageArgs() { return messageArgs == null ? new Object[0] : messageArgs; }
}
