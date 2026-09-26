package com.hotelapp.enums;

/**
 * Ödeme netliği — ücret NE ZAMAN ödenir?
 * Günlük işlerde en sık şikayet "param ne zaman yatacak" belirsizliği;
 * aday başvurmadan önce bilsin.
 */
public enum PaymentPeriod {
    SAME_DAY,   // iş bitiminde / aynı gün
    WEEKLY,     // haftalık
    BIWEEKLY,   // 15 günde bir
    MONTHLY     // aylık
}
