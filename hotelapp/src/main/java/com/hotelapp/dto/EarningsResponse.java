package com.hotelapp.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * FAZ 13 — Aday kazanc ledger'i.
 *
 * Onemli: Bu bir bordro sistemi DEGIL — platform para islemez. Tutarlar,
 * ilan ucret bilgisinden (salaryMin/Max ortalamasi) hesaplanan TAHMINI
 * brut kazanctir. Net/vergi/kesinti tutulmaz. Bahsis sadece "dahil" flag'i
 * (miktar bilinmez). Saatler mumkun oldugunda gercek clock-in/out'tan,
 * yoksa planlanan slot suresinden gelir (source alani ayirir).
 */
@Data
@Builder
public class EarningsResponse {

    // ── Ozet ──
    private BigDecimal totalGross;
    private BigDecimal thisMonthGross;
    private BigDecimal thisYearGross;
    private double totalHours;
    private int shiftCount;
    /** Ucret tipi belirsiz (NEGOTIABLE) olan ve hesaplanamayan vardiya sayisi */
    private int unpricedShiftCount;

    private List<LedgerEntry> entries;

    @Data
    @Builder
    public static class LedgerEntry {
        private Long applicationId;
        private LocalDate date;
        private String businessName;
        private String listingTitle;
        private String position;          // enum adi
        private double hours;
        private BigDecimal gross;         // null = hesaplanamadi (NEGOTIABLE)
        private String salaryType;        // HOURLY | DAILY | MONTHLY | NEGOTIABLE
        private boolean tipsIncluded;
        /** CLOCKED = gercek mesai kaydi, PLANNED = planlanan slot suresi */
        private String hoursSource;
    }
}
