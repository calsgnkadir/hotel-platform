package com.hotelapp.enums;

/**
 * İlan vardiya kategorileri — 3 sabit zaman aralığı.
 *  MORNING:  08:00 – 16:00
 *  EVENING:  16:00 – 24:00
 *  NIGHT:    22:00 – 08:00
 *
 * İşletme ilan açarken birini seçer, aday filtrede çoklu seçim yapabilir.
 */
public enum Shift {
    MORNING,
    EVENING,
    NIGHT
}
