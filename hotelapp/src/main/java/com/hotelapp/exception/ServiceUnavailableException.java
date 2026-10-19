package com.hotelapp.exception;

/** Dış servis (ör. adres arama) geçici olarak yanıt vermiyor → HTTP 503, Türkçe mesaj. */
public class ServiceUnavailableException extends RuntimeException {
    public ServiceUnavailableException(String message) {
        super(message);
    }
}
