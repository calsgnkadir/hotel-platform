package com.hotelapp.enums;

/**
 * FAZ 2/#25 — Ucret tipi seffafligi.
 * Sektorde "X TL" demek belirsiz: saatlik mi gunluk mu aylik mi?
 * Aday onceden bilsin diye explicit tip taniyoruz.
 */
public enum SalaryType {
    HOURLY,      // saatlik (vardiyali ilanlar — en seffaf)
    DAILY,       // gunluk (sezonluk/event)
    MONTHLY,     // aylik (uzun donem kadro)
    NEGOTIABLE   // gorusulecek (gizlemek isteyen isveren icin)
}
