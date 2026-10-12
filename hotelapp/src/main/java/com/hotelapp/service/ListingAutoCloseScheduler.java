package com.hotelapp.service;

import com.hotelapp.enums.ListingStatus;
import com.hotelapp.repository.JobListingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.EnumSet;
import java.util.List;

/**
 * İlan son vardiyası bitince otomatik kapanır (abonelik bitişi ilan kapatmaz).
 *
 * <p>Her koşuda aday ilanlar (ACTIVE/PAUSED, hiçbir slotu bugünden sonra başlamayan)
 * tek sorguyla seçilir; kesin karar {@link JobListingService#autoCloseIfEnded} içinde
 * {@link ShiftWindow#lastEnd} ile verilir (gece vardiyası ertesi gün biter). Her ilan
 * ayrı transaction'da işlenir: biri hata verirse diğerleri devam eder. Kapanan ilan
 * tekrar seçilmez, bu yüzden ikinci koşu bildirim üretmez.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ListingAutoCloseScheduler {

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");

    private final JobListingRepository jobListingRepository;
    private final JobListingService jobListingService;

    /** Testlerde sabit zaman için değiştirilebilir. */
    Clock clock = Clock.system(TR);

    @Scheduled(fixedDelayString = "${app.listing.auto-close-delay-ms:900000}",
               initialDelayString = "${app.listing.auto-close-initial-delay-ms:60000}")
    public void run() {
        try {
            closeEndedListings(LocalDateTime.now(clock));
        } catch (RuntimeException e) {
            log.warn("[AUTO-CLOSE] koşu başarısız: {}", e.getMessage());
        }
    }

    /** @return bu koşuda kapatılan ilan sayısı */
    public int closeEndedListings(LocalDateTime now) {
        List<Long> ids = jobListingRepository.findAutoCloseCandidateIds(
                EnumSet.of(ListingStatus.ACTIVE, ListingStatus.PAUSED), now.toLocalDate());
        int closed = 0;
        for (Long id : ids) {
            try {
                if (jobListingService.autoCloseIfEnded(id, now)) closed++;
            } catch (RuntimeException e) {
                // Bir ilanın hatası diğerlerini durdurmasın; sonraki koşuda yeniden denenir.
                log.warn("[AUTO-CLOSE] ilan={} kapatılamadı: {}", id, e.getMessage());
            }
        }
        if (closed > 0) log.info("[AUTO-CLOSE] {} ilan son vardiyası bittiği için kapatıldı", closed);
        return closed;
    }
}
