package com.hotelapp.exception;

/**
 * Hata yanıtına makine tarafından okunur {@code code} alanı ekleyen istisnalar.
 * Frontend mesaj metnine değil bu koda göre davranır (ör. EMAIL_NOT_VERIFIED).
 */
public interface CodedError {
    String getCode();
}
