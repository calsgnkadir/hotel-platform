package com.hotelapp.enums;

public enum ApplicationStatus {
    PENDING,      // başvuru yapıldı, otel henüz bakmadı
    REVIEWING,    // otel inceliyor
    HELD,         // FAZ 2/#28 — isletme tutmak istiyor, aday 24 saatinde karar verecek
    STANDBY,      // FAZ C.1 — yedek aday: asil aday gelmezse otomatik teklif gider
    ACCEPTED,     // kabul edildi
    REJECTED,     // reddedildi
    EXPIRED,      // 1 hafta içinde cevap gelmedi (veya HELD 24 saat dolup cevap gelmedi)
    WITHDRAWN;    // aday kendisi iptal etti (PENDING/REVIEWING aşamasında)

    /** Kullanıcıya dönen mesajlar için Türkçe karşılık (API'de enum adı değişmez). */
    public String label() {
        return switch (this) {
            case PENDING   -> "Beklemede";
            case REVIEWING -> "İnceleniyor";
            case HELD      -> "Teklif edildi";
            case STANDBY   -> "Yedekte";
            case ACCEPTED  -> "Kabul edildi";
            case REJECTED  -> "Reddedildi";
            case EXPIRED   -> "Süresi doldu";
            case WITHDRAWN -> "Geri çekildi";
        };
    }
}
