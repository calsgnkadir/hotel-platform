package com.hotelapp.enums;

/** Şikayet nedeni */
public enum ReportReason {
    FAKE,           // sahte ilan/işletme
    SPAM,           // spam / tekrarlayan içerik
    SCAM,           // dolandırıcılık
    INAPPROPRIATE,  // uygunsuz içerik
    HARASSMENT,     // taciz / kötü davranış
    OTHER           // diğer (açıklama zorunlu)
}
