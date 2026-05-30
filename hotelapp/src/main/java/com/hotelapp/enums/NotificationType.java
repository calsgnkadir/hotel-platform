package com.hotelapp.enums;

/** Bildirim tipleri — frontend ikon/renk seçiminde kullanır */
public enum NotificationType {
    // Aday'a
    APPLICATION_ACCEPTED,   // başvurun kabul edildi
    APPLICATION_REJECTED,   // başvurun reddedildi
    DOCUMENT_REQUEST,       // işletme belge talep etti
    NO_SHOW_MARKED,         // no-show işaretlendin
    AUTO_BANNED,            // otomatik banlandın

    // İşletme'ye
    NEW_APPLICATION,        // yeni başvuru geldi
    APPLICATION_WITHDRAWN,  // aday başvurusunu iptal etti
    DOCUMENT_GRANTED,       // aday belge iznini verdi
    DOCUMENT_DENIED,        // aday belge iznini reddetti

    // ADIM J: Tercihlerine uygun yeni ilan
    MATCHING_LISTING,

    GENERIC                 // genel
}
