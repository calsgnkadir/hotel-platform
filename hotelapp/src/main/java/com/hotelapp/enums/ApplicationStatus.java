package com.hotelapp.enums;

public enum ApplicationStatus {
    PENDING,      // başvuru yapıldı, otel henüz bakmadı
    REVIEWING,    // otel inceliyor
    HELD,         // FAZ 2/#28 — isletme tutmak istiyor, aday 24 saatinde karar verecek
    ACCEPTED,     // kabul edildi
    REJECTED,     // reddedildi
    EXPIRED,      // 1 hafta içinde cevap gelmedi (veya HELD 24 saat dolup cevap gelmedi)
    WITHDRAWN     // aday kendisi iptal etti (PENDING/REVIEWING aşamasında)
}
