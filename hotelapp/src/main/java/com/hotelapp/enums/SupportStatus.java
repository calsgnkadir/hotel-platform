package com.hotelapp.enums;

/** FAZ I.5 — Destek bileti yaşam döngüsü durumu. */
public enum SupportStatus {
    OPEN,        // Yeni — admin henüz görmedi
    IN_PROGRESS, // Admin inceliyor
    RESOLVED,    // Çözüldü, kullanıcıya cevap iletildi
    DISMISSED    // Geçersiz/spam, sessiz kapat
}
