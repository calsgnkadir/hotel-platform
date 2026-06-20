package com.hotelapp.security;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * FAZ H.4 — JPA AttributeConverter (manuel @Convert ile bağlanır).
 *
 * Entity field'ında: @Convert(converter = EncryptedStringConverter.class)
 * Legacy: prefix yoksa plain → olduğu gibi geçer (geriye uyumluluk).
 *
 * autoApply=false (kazara her String'i şifrelememek için).
 */
@Converter(autoApply = false)
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    @Override
    public String convertToDatabaseColumn(String attribute) {
        EncryptionService svc = EncryptionHolder.get();
        if (svc == null) return attribute;  // pre-boot / test fallback
        return svc.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        EncryptionService svc = EncryptionHolder.get();
        if (svc == null) return dbData;
        return svc.decrypt(dbData);
    }
}
