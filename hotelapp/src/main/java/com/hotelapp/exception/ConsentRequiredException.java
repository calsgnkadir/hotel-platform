package com.hotelapp.exception;

/**
 * Google ile ilk girişte (ya da onay kaydı olmayan hesapta) Kullanım Şartları /
 * Aydınlatma Metni onayı gönderilmedi → HTTP 422, {@code code: "CONSENT_REQUIRED"}.
 */
public class ConsentRequiredException extends BusinessRuleException implements CodedError {

    public static final String CODE = "CONSENT_REQUIRED";
    public static final String MESSAGE =
            "Devam etmek için Kullanım Şartları'nı ve Aydınlatma Metni'ni onayla.";

    public ConsentRequiredException() {
        super(MESSAGE);
    }

    @Override public String getCode() { return CODE; }
}
