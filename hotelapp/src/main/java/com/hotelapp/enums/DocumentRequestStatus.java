package com.hotelapp.enums;

public enum DocumentRequestStatus {
    PENDING,   // otel talep etti, öğrenci henüz yanıtlamadı
    GRANTED,   // öğrenci onayladı → otel belgeyi görebilir
    DENIED     // öğrenci reddetti
}
