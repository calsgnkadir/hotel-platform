package com.hotelapp.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Kaynak var ama bu kullanıcıya ait değil → HTTP 403
 * Örnek: başka öğrencinin belgesini silmeye çalışmak,
 *        başka otelin başvurusuna karar vermeye çalışmak
 */
@ResponseStatus(HttpStatus.FORBIDDEN)
public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String message) {
        super(message);
    }
}
