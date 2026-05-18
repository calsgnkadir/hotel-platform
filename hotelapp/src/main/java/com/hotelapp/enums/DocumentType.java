package com.hotelapp.enums;

public enum DocumentType {
    // Öğrencinin direkt yükleyip herkese açık tutabileceği belgeler
    CV,
    TRANSCRIPT,           // transkript
    STUDENT_CERTIFICATE,  // öğrenci belgesi

    // Hassas belgeler - otel talep etmeden görülemez
    CRIMINAL_RECORD,      // adli sicil kaydı
    HEALTH_CERTIFICATE,   // sağlık belgesi
    IDENTITY_DOCUMENT     // kimlik fotokopisi
}
