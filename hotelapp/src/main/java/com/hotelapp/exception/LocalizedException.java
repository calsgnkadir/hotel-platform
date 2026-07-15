package com.hotelapp.exception;

/**
 * FAZ 12.1 — i18n destekli exception isareti.
 *
 * Exception bir message key tasiyorsa GlobalExceptionHandler bunu
 * MessageSource + Accept-Language ile cozer. Key null ise legacy
 * getMessage() (hardcoded Turkce) kullanilir — geriye donuk uyumlu.
 */
public interface LocalizedException {

    /** Cozulecek message key, ornek "error.application.notOwner". null = legacy string. */
    String getMessageKey();

    /** MessageFormat argumanlari ({0}, {1}...). */
    default Object[] getMessageArgs() {
        return new Object[0];
    }
}
