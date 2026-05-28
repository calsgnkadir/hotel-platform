package com.hotelapp.enums;

/** Şikayetin admin tarafından işlenme durumu */
public enum ReportStatus {
    PENDING,    // yeni, admin henüz bakmadı
    RESOLVED,   // incelendi, işlem yapıldı (örn. ban)
    DISMISSED   // incelendi, geçersiz/asılsız bulundu
}
