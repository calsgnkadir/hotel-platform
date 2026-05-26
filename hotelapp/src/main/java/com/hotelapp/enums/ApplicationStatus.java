package com.hotelapp.enums;

public enum ApplicationStatus {
    PENDING,      // başvuru yapıldı, otel henüz bakmadı
    REVIEWING,    // otel inceliyor
    ACCEPTED,     // kabul edildi
    REJECTED,     // reddedildi
    EXPIRED,      // 1 hafta içinde cevap gelmedi
    WITHDRAWN     // aday kendisi iptal etti (PENDING/REVIEWING aşamasında)
}
