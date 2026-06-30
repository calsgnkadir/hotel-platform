package com.hotelapp.service;

import com.hotelapp.entity.SavedSearch;
import com.hotelapp.repository.SavedSearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * FAZ 5 — Kayıtlı arama eşleşme tarayıcısı.
 *
 * 30 dk fixedDelay → bildirimleri aktif olan tüm aramaları gez, yeni eşleşme
 * varsa notification at + lastNotifiedAt'ı güncelle. Tek bir aramanın hatası
 * diğerlerini bloklamasın diye her biri try/catch içinde.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SavedSearchScheduler {

    private final SavedSearchRepository repo;
    private final SavedSearchService savedSearchService;

    @Scheduled(fixedDelay = 30 * 60 * 1000, initialDelay = 60 * 1000)
    public void scan() {
        // Sadece ID'leri çek — her aramayı kendi tx'ında işle ki birinin hatası
        // diğerlerini bloklamasın (notifyNewMatches @Transactional).
        List<Long> ids = repo.findAllEnabled().stream().map(SavedSearch::getId).toList();
        if (ids.isEmpty()) return;

        int totalMatches = 0;
        for (Long id : ids) {
            try {
                totalMatches += savedSearchService.notifyNewMatches(id);
            } catch (Exception e) {
                log.warn("[SAVED-SEARCH] id={} taraması başarısız: {}", id, e.getMessage());
            }
        }
        if (totalMatches > 0) {
            log.info("[SAVED-SEARCH] {} arama taradı, toplam {} yeni eşleşme bildirildi",
                    ids.size(), totalMatches);
        }
    }
}
