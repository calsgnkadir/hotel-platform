package com.hotelapp.event;

import java.time.LocalDateTime;

/**
 * FAZ 4.11 — markNoShow synchronous transaction commit olduktan sonra
 * publish edilir. Async listener notification/email/audit log yazar.
 *
 * Immutable payload — async thread'e detached entity gecirmemek icin
 * sadece primitive value'lar tasinir.
 */
public record NoShowMarkedEvent(
        Long actorOwnerId,
        Long applicationId,
        Long candidateId,
        // KVKK: e-posta tasinmaz; audit/log aday id'si ile yazilir.
        String candidateName,
        String listingTitle,
        int candidateStrikesRemaining,
        boolean autoBanned,
        LocalDateTime bannedUntil,
        /** Bosaltilan vardiya slotlari — yedek eslesmesi bunlarla kesisen talep uzerinden. */
        java.util.List<Long> vacatedSlotIds
) {}
