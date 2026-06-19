package com.hotelapp.event;

/**
 * FAZ D.9 — Outbox email payload.
 *
 * Email gonderim isteklerini outbox tablosuna yazmak icin kullanilir.
 * OutboxRelay scheduler async olarak EmailService.send() cagirir.
 * Fail olursa attempts++/lastError, max 5 deneme.
 *
 * Immutable record — JSON serialize dostu.
 */
public record EmailMessage(
        String to,
        String subject,
        String html
) {}
