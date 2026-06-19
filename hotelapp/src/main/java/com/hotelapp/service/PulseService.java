package com.hotelapp.service;

import com.hotelapp.enums.ListingStatus;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.ShiftSlotRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * FAZ G.8 — Platform nabzı (Vardiya Nabzı).
 *
 * Periyodik (30 sn) olarak topluluk metric'leri hesaplar ve /topic/pulse'a
 * yayınlar. Landing'deki canlı widget bu broadcast'i dinler — manifestodaki
 * "diri pazar yeri" hissinin teknik altyapısı.
 *
 * Public REST endpoint /api/public/pulse: WS bağlantısı yok ya da ilk
 * yüklemede initial state için.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PulseService {

    private final JobListingRepository jobListingRepository;
    private final ShiftSlotRepository shiftSlotRepository;
    private final ApplicationRepository applicationRepository;
    private final PresenceService presenceService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional(readOnly = true)
    public PulseDto snapshot() {
        LocalDateTime hourAgo = LocalDateTime.now().minusHours(1);
        LocalDate today = LocalDate.now();
        return PulseDto.builder()
                .activeListings(jobListingRepository.countByStatus(ListingStatus.ACTIVE))
                .openShifts(shiftSlotRepository.countOpenSlots(today))
                .applicationsLastHour(applicationRepository.countByCreatedAtAfter(hourAgo))
                .onlineUsers(presenceService.getOnlineUserIds().size())
                .generatedAt(LocalDateTime.now())
                .build();
    }

    /**
     * Her 30 sn'de bir pulse hesapla ve yayınla. Subscriber yoksa Spring
     * STOMP broker no-op gerçekleştirir; sayım sorguları light, riski yok.
     */
    @Scheduled(fixedDelayString = "${app.pulse.intervalMs:30000}", initialDelay = 10_000)
    public void broadcast() {
        try {
            PulseDto p = snapshot();
            messagingTemplate.convertAndSend("/topic/pulse", p);
        } catch (Exception ex) {
            log.warn("[PULSE] broadcast failed: {}", ex.getMessage());
        }
    }

    @Data @Builder
    public static class PulseDto {
        private long activeListings;
        private long openShifts;
        private long applicationsLastHour;
        private long onlineUsers;
        private LocalDateTime generatedAt;
    }
}
