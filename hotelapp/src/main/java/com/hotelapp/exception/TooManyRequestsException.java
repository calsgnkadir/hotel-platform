package com.hotelapp.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** Uygulama katmani hiz siniri asildi → HTTP 429 (ornek: e-posta basina giris denemesi). */
@ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
public class TooManyRequestsException extends RuntimeException {
    public TooManyRequestsException(String message) {
        super(message);
    }
}
