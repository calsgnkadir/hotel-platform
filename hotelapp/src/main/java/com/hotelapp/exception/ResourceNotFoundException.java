package com.hotelapp.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Kayıt bulunamadığında fırlatılır → HTTP 404
 * Örnek: findById ile bulunamayan User, Application, Document
 *
 * FAZ 12 — i18n: (resourceName, id) constructor'u error.resource.notFound
 * key'ini kullanir; resourceName arg olarak {0}'a girer. Legacy tek-String
 * constructor hardcoded kalir.
 */
@ResponseStatus(HttpStatus.NOT_FOUND)
public class ResourceNotFoundException extends RuntimeException implements LocalizedException {

    private final String resourceName;
    private final transient Object resourceId;

    public ResourceNotFoundException(String resourceName, Object resourceId) {
        super(resourceName + " bulunamadı: " + resourceId);
        this.resourceName = resourceName;
        this.resourceId = resourceId;
    }

    public ResourceNotFoundException(String message) {
        super(message);
        this.resourceName = null;
        this.resourceId = null;
    }

    @Override
    public String getMessageKey() {
        // Sadece (isim, id) formunda i18n key kullan; legacy tek-mesaj null doner.
        return resourceName != null ? "error.resource.notFound" : null;
    }

    @Override
    public Object[] getMessageArgs() {
        return resourceName != null ? new Object[]{ resourceName, resourceId } : new Object[0];
    }
}
