package com.hotelapp.exception;

/**
 * E-postası doğrulanmamış hesap kritik işlem (ilan yayınlama, başvuru, sohbet
 * başlatma) denedi → HTTP 403, {@code code: "EMAIL_NOT_VERIFIED"}.
 */
public class EmailNotVerifiedException extends UnauthorizedException implements CodedError {

    public static final String CODE = "EMAIL_NOT_VERIFIED";
    public static final String MESSAGE = "Devam etmek için e-posta adresini doğrula.";

    public EmailNotVerifiedException() {
        super(MESSAGE);
    }

    @Override public String getCode() { return CODE; }
}
