package com.hotelapp.enums;

/** iyzico ödeme oturumu (payment_checkouts.status, V23). */
public enum PaymentCheckoutStatus {
    PENDING,     // form başlatıldı, sonuç henüz işlenmedi
    SUCCEEDED,   // ödeme doğrulandı, abonelik uygulandı
    FAILED,      // ödeme başarısız ya da doğrulanamadı (tutar/sepet/conversation uyuşmazlığı)
    EXPIRED      // 24 saat içinde ödenmedi
}
