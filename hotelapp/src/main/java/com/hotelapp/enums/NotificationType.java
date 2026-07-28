package com.hotelapp.enums;

/** Bildirim tipleri — frontend ikon/renk seçiminde kullanır */
public enum NotificationType {
    // Aday'a
    APPLICATION_ACCEPTED,   // başvurun kabul edildi
    APPLICATION_REJECTED,   // başvurun reddedildi
    DOCUMENT_REQUEST,       // işletme belge talep etti
    NO_SHOW_MARKED,         // no-show işaretlendin
    AUTO_BANNED,            // otomatik banlandın
    STANDBY_ASSIGNED,       // FAZ C.1 — yedek aday olarak işaretlendin
    STANDBY_ACTIVATED,      // FAZ C.1 — asıl aday gelmedi, sıra sende (acil teklif)
    STANDBY_OFFER_EXPIRED,  // FAZ C.1 — yedek teklifine süresinde cevap vermedin
    URGENT_LISTING,         // FAZ C.2 — "hemen müsait"sin ve acil ilan açıldı

    // İşletme'ye
    NEW_APPLICATION,        // yeni başvuru geldi
    APPLICATION_WITHDRAWN,  // aday başvurusunu iptal etti
    DOCUMENT_GRANTED,       // aday belge iznini verdi
    DOCUMENT_DENIED,        // aday belge iznini reddetti
    STANDBY_FILLED,         // FAZ C.1 — yedek aday açığı kapattı
    STANDBY_DECLINED,       // FAZ C.1 — yedek aday teklifi reddetti / süresi doldu
    SGK_REMINDER,           // FAZ C.3 — işe giriş bildirgesi (SGK) hatırlatıcı

    // ADIM J: Tercihlerine uygun yeni ilan
    MATCHING_LISTING,

    // #76: Mesajlaşma
    NEW_MESSAGE,            // yeni sohbet mesajı geldi

    GENERIC                 // genel
}
