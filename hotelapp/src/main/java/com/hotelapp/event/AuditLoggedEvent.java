package com.hotelapp.event;

/**
 * FAZ 4.10 — Generic audit log event.
 *
 * Servicelerden direkt AuditLogService.log()/logSystem() cagirmak yerine
 * bu event publish edilir. AuditEventListener async + AFTER_COMMIT yazar.
 *
 * Avantajlar:
 *  - Decoupling: domain service AuditLogService bagimliligi tasimaz
 *  - Async: ana request kullanici cevabini bekletmez
 *  - Multi-listener: ileride analytics/monitoring icin ayni event uzerine listener eklenebilir
 *
 * isSystem=true → actor "SYSTEM" yazilir (orn. otomatik ban).
 */
public record AuditLoggedEvent(
        Long actorId,        // null = system
        String action,
        String targetType,
        Long targetId,
        String details,
        boolean isSystem
) {
    /** User action helper. */
    public static AuditLoggedEvent user(Long actorId, String action, String targetType,
                                         Long targetId, String details) {
        return new AuditLoggedEvent(actorId, action, targetType, targetId, details, false);
    }

    /** System action helper. */
    public static AuditLoggedEvent system(String action, String targetType,
                                           Long targetId, String details) {
        return new AuditLoggedEvent(null, action, targetType, targetId, details, true);
    }
}
