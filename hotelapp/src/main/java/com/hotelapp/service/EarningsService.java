package com.hotelapp.service;

import com.hotelapp.dto.EarningsResponse;
import com.hotelapp.dto.EarningsResponse.LedgerEntry;
import com.hotelapp.entity.Application;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.WorkSession;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.SalaryType;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.WorkSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/**
 * FAZ 13 — Aday kazanc ledger'i.
 *
 * Her tamamlanmis vardiya = 1 satir. Saat gercek clock-in/out'tan (varsa)
 * yoksa planlanan slot suresinden gelir. Brut = saat x ortalama ucret
 * (salaryMin/Max ort). NEGOTIABLE ucret hesaplanmaz (unpriced sayilir).
 *
 * Not: platform para islemez — bu TAHMINI brut kazanctir, bordro degil.
 */
@Service
@RequiredArgsConstructor
public class EarningsService {

    private final ApplicationRepository applicationRepository;
    private final WorkSessionRepository workSessionRepository;

    // MONTHLY ucreti saatlige cevirmek icin: 22 is gunu x 8 saat.
    private static final BigDecimal MONTHLY_HOURS = BigDecimal.valueOf(22L * 8);

    @Transactional(readOnly = true)
    public EarningsResponse getMyEarnings(Long candidateId) {
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate yearStart  = today.withDayOfYear(1);

        BigDecimal totalGross = BigDecimal.ZERO;
        BigDecimal monthGross = BigDecimal.ZERO;
        BigDecimal yearGross  = BigDecimal.ZERO;
        double totalHours = 0;
        int shiftCount = 0;
        int unpriced = 0;
        java.util.List<LedgerEntry> entries = new java.util.ArrayList<>();

        List<Application> apps = applicationRepository.findAllByCandidateId(candidateId);
        for (Application app : apps) {
            if (app.getStatus() != ApplicationStatus.ACCEPTED) continue;

            var listing = app.getJobListing();
            if (listing == null) continue;
            var slots = app.getRequestedSlots();
            if (slots == null || slots.isEmpty()) continue;

            SalaryType type = listing.getSalaryType();
            BigDecimal rate = avgRate(listing.getSalaryMin(), listing.getSalaryMax());
            boolean tips = Boolean.TRUE.equals(listing.getTipsIncluded());
            String bizName = listing.getBusiness() != null ? listing.getBusiness().getName() : null;

            // Bu basvurunun mesai kayitlari — tarih -> gercek saat
            List<WorkSession> sessions = workSessionRepository.findByApplicationIdOrderByClockInAtDesc(app.getId());

            for (ShiftSlot slot : slots) {
                if (slot.getDate() == null) continue;
                if (!slot.getDate().isBefore(today)) continue;  // sadece gecmis (tamamlanmis) vardiyalar

                // Gercek clocked saat var mi (ayni gunde clock-out'lu session)?
                Double clockedHours = clockedHoursForDate(sessions, slot.getDate());
                double hours;
                String source;
                if (clockedHours != null && clockedHours > 0) {
                    hours = clockedHours;
                    source = "CLOCKED";
                } else {
                    hours = plannedHours(slot);
                    source = "PLANNED";
                }
                if (hours <= 0) continue;

                BigDecimal gross = computeGross(hours, type, rate);

                totalHours += hours;
                shiftCount++;
                if (gross != null) {
                    totalGross = totalGross.add(gross);
                    if (!slot.getDate().isBefore(monthStart)) monthGross = monthGross.add(gross);
                    if (!slot.getDate().isBefore(yearStart))  yearGross  = yearGross.add(gross);
                } else {
                    unpriced++;
                }

                entries.add(LedgerEntry.builder()
                        .applicationId(app.getId())
                        .date(slot.getDate())
                        .businessName(bizName)
                        .listingTitle(listing.getTitle())
                        .position(listing.getPosition() != null ? listing.getPosition().name() : null)
                        .hours(round1(hours))
                        .gross(gross)
                        .salaryType(type != null ? type.name() : "NEGOTIABLE")
                        .tipsIncluded(tips)
                        .hoursSource(source)
                        .build());
            }
        }

        entries.sort(Comparator.comparing(LedgerEntry::getDate).reversed());

        return EarningsResponse.builder()
                .totalGross(scale(totalGross))
                .thisMonthGross(scale(monthGross))
                .thisYearGross(scale(yearGross))
                .totalHours(round1(totalHours))
                .shiftCount(shiftCount)
                .unpricedShiftCount(unpriced)
                .entries(entries)
                .build();
    }

    /* ── Hesaplama yardimcilari (package-private, test edilebilir) ── */

    /** Ortalama ucret: min+max varsa ort, biri varsa o, ikisi de yoksa null. */
    static BigDecimal avgRate(BigDecimal min, BigDecimal max) {
        if (min != null && max != null) {
            return min.add(max).divide(BigDecimal.valueOf(2), 4, RoundingMode.HALF_UP);
        }
        if (min != null) return min;
        return max;  // null olabilir
    }

    /**
     * Brut kazanc. NEGOTIABLE veya rate yoksa null (hesaplanamaz).
     *  - HOURLY  : saat x rate
     *  - DAILY   : rate (vardiya basi gunluk ucret; saatten bagimsiz)
     *  - MONTHLY : (rate / 176) x saat
     */
    static BigDecimal computeGross(double hours, SalaryType type, BigDecimal rate) {
        if (type == null || type == SalaryType.NEGOTIABLE || rate == null) return null;
        BigDecimal h = BigDecimal.valueOf(hours);
        BigDecimal gross = switch (type) {
            case HOURLY  -> rate.multiply(h);
            case DAILY   -> rate;
            case MONTHLY -> rate.divide(MONTHLY_HOURS, 6, RoundingMode.HALF_UP).multiply(h);
            default      -> null;
        };
        return gross == null ? null : gross.setScale(2, RoundingMode.HALF_UP);
    }

    /** Slot planlanan suresi (saat), start/end'ten. */
    static double plannedHours(ShiftSlot slot) {
        if (slot.getStartTime() == null || slot.getEndTime() == null) return 0;
        double h = Duration.between(slot.getStartTime(), slot.getEndTime()).toMinutes() / 60.0;
        return h > 0 ? h : 0;
    }

    /** Belirli tarihte clock-out'lu session'in gercek suresi (saat) — yoksa null. */
    private Double clockedHoursForDate(List<WorkSession> sessions, LocalDate date) {
        for (WorkSession ws : sessions) {
            if (ws.getClockInAt() == null || ws.getClockOutAt() == null) continue;
            if (!ws.getClockInAt().toLocalDate().equals(date)) continue;
            double h = Duration.between(ws.getClockInAt(), ws.getClockOutAt()).toMinutes() / 60.0;
            if (h > 0) return h;
        }
        return null;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static BigDecimal scale(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v.setScale(2, RoundingMode.HALF_UP);
    }
}
