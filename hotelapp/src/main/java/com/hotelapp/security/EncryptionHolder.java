package com.hotelapp.security;

/**
 * FAZ H.4 — JPA AttributeConverter'lar Spring DI ile yönetilmediği için
 * EncryptionService'e ulaşmak için statik köprü.
 *
 * EncryptionService.@PostConstruct ile set edilir; converter call'ları
 * get() ile alır. Bean yoksa (boot sırası vs.) varsayılan instance
 * "disabled" döner — yani plain text round-trip.
 */
public final class EncryptionHolder {

    private static volatile EncryptionService instance;

    private EncryptionHolder() {}

    static void set(EncryptionService svc) {
        instance = svc;
    }

    public static EncryptionService get() {
        return instance;
    }
}
