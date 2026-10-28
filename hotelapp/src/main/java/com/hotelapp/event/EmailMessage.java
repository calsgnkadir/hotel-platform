package com.hotelapp.event;

/**
 * FAZ D.9 — Outbox email payload.
 *
 * Email gonderim isteklerini outbox tablosuna yazmak icin kullanilir.
 * OutboxRelay scheduler async olarak EmailService.send() cagirir.
 * Fail olursa attempts++/lastError, max 10 deneme. Optional attachment survives retries.
 *
 * Immutable record — JSON serialize dostu.
 */
public record EmailMessage(
        String to,
        String subject,
        String html,
        Attachment attachment,
        Long deliveryNoticeUserId
) {
    public EmailMessage(String to, String subject, String html) {
        this(to, subject, html, null, null);
    }

    /** Bounded immutable snapshot; Base64 is serialized only into the protected outbox payload. */
    public record Attachment(String fileName, byte[] content) {
        public static final int MAX_BYTES = 2 * 1024 * 1024;

        public Attachment {
            if (fileName == null || fileName.isBlank() || fileName.length() > 255
                    || fileName.indexOf('\n') >= 0 || fileName.indexOf('\r') >= 0) {
                throw new IllegalArgumentException("Ek dosya adı geçersiz");
            }
            if (content == null || content.length == 0 || content.length > MAX_BYTES) {
                throw new IllegalArgumentException("Ek dosya boş veya 2 MiB sınırını aşıyor");
            }
            content = content.clone();
        }

        @Override public byte[] content() { return content.clone(); }
    }
}
