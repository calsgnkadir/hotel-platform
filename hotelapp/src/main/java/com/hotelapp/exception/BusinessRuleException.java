package com.hotelapp.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * İş kuralı ihlalinde fırlatılır → HTTP 422 Unprocessable Entity
 * Örnek: aynı otele çift başvuru, sonuçlanmış başvuruya karar verme,
 *        süresi dolmuş başvuru, geçersiz durum geçişi
 */
@ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
public class BusinessRuleException extends RuntimeException {

    public BusinessRuleException(String message) {
        super(message);
    }
}
