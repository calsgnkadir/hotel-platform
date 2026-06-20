package com.hotelapp.enums;

/**
 * FAZ I.5 — Destek bileti konu kategorileri.
 * Frontend dropdown ile birebir eşleşir; kategori bazlı admin yönlendirme
 * yapılabilir (örn. KVKK → veri sorumlusu, BUSINESS_VERIFY → moderasyon).
 */
public enum SupportSubject {
    GENERAL,           // Genel soru
    ACCOUNT,           // Hesap / Giriş / Şifre
    KVKK,              // KVKK madde 11 başvuruları
    BUSINESS_VERIFY,   // İşletme doğrulama
    TECHNICAL,         // Teknik sorun / bug
    PARTNERSHIP        // İş birliği / Basın
}
