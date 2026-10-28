package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.WorkSession;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.WorkSessionRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Geo-fenced clock-in and read access to work sessions.
 *
 * Aday "Mesaiye Basla" basinca GPS koordinati gelir, isletmenin konumuyla
 * Haversine formulu ile metre cinsinden mesafe hesaplanir. 200m disindaysa
 * reddedilir. Acik session varsa once cikis karti gorevliye okutulmalidir.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WorkSessionService {

    /** Geo-fence radius (metre). Cok titiz olmamali — GPS dogrulugu mobile'da +/-50m */
    private static final int FENCE_RADIUS_METERS = 200;

    /** Dunya yaricapi (metre) — Haversine icin */
    private static final double EARTH_RADIUS_M = 6_371_000;

    private final WorkSessionRepository workSessionRepository;
    private final ApplicationRepository applicationRepository;
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

    @Transactional
    public WorkSessionDto clockIn(Long candidateId, Long applicationId,
                                   BigDecimal lat, BigDecimal lng) {
        Application app = applicationRepository.findByIdForCheckIn(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));
        validateApplication(app, candidateId);
        if (lat == null || lng == null) {
            throw new BusinessRuleException("Konum bilgisi alınamadı. Konum iznini açıp tekrar dene.");
        }
        // Kapalı ya da yönetici tarafından askıya alınmış ilanda yeni giriş yok.
        com.hotelapp.entity.JobListing listing = app.getJobListing();
        if (listing.getStatus() == com.hotelapp.enums.ListingStatus.CLOSED || listing.isAdminSuspended()) {
            throw new BusinessRuleException("Bu ilan kapalı; mesai girişi yapılamaz.");
        }
        Business biz = listing.getBusiness();

        // Isletme konumu yoksa fence yapilamaz
        if (biz.getLatitude() == null || biz.getLongitude() == null) {
            throw new BusinessRuleException(
                    "İşletmenin konumu sisteme girilmemiş; konumla mesai girişi yapılamaz.");
        }

        int distance = haversineMeters(
                lat, lng, biz.getLatitude(), biz.getLongitude());

        if (distance > FENCE_RADIUS_METERS) {
            throw new BusinessRuleException(String.format(
                    "İş yerine çok uzaktasın (yaklaşık %d m). En fazla %d m uzaklıkta olmalısın.",
                    distance, FENCE_RADIUS_METERS));
        }

        // Aday'in baska acik session'i olmamali (overlapping nokta isi)
        List<WorkSession> openSessions =
                workSessionRepository.findByApplicationCandidateIdAndClockOutAtIsNull(candidateId);
        if (!openSessions.isEmpty()) {
            throw new BusinessRuleException(
                    "Zaten açık bir mesain var. Önce çıkış kartını işletme görevlisine okutmalısın.");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        ShiftSlot slot = ShiftAttendance.inferSlot(app.getRequestedSlots(), now).orElse(null);
        // Vardiyalı başvuruda giriş yalnız vardiya gününde, vardiya bitmeden (QR kartla aynı
        // pencere). Slotsuz eski başvuru (Faz E1 öncesi) saat bilgisi taşımadığı için istisna:
        // slotu yoktur, kapalı ilan kuralı yukarıda sınırlar.
        boolean slotted = app.getRequestedSlots() != null && !app.getRequestedSlots().isEmpty();
        if (slotted && slot == null && !NoShowSlots.isLegacy(app)) {
            throw new BusinessRuleException(
                    "Şu anda devam eden bir vardiyan yok. Mesai girişi yalnız vardiya gününde, vardiya bitmeden yapılabilir.");
        }
        // Gelmedi isaretli vardiyada (V25 satiri) giris yok. Eski kayit (satir yok):
        // o saatte eslesen vardiya da yoksa giris yok (onceki davranis).
        if (NoShowSlots.isMarked(app, slot) || (slot == null && NoShowSlots.isLegacy(app))) {
            throw new BusinessRuleException(CheckInService.NO_SHOW_ENTRY);
        }
        if (slot != null && ShiftAttendance.sessionFor(app, slot,
                workSessionRepository.findByApplicationIdOrderByClockInAtDesc(applicationId)).isPresent()) {
            throw new BusinessRuleException("Bu vardiya için giriş zaten kayıtlı");
        }
        WorkSession ws = WorkSession.builder()
                .application(app)
                .shiftSlotId(slot == null ? null : slot.getId())
                .clockInAt(now)
                .clockInLat(lat)
                .clockInLng(lng)
                .clockInDistanceMeters(distance)
                .build();
        workSessionRepository.save(ws);
        log.info("[WS-CLOCK-IN] appId={} candId={} dist={}m", applicationId, candidateId, distance);
        return toDto(ws);
    }

    /** Aday: acik session var mi? (UI butonu kararsiz olmasin) */
    @Transactional(readOnly = true)
    public WorkSessionDto getActiveSession(Long candidateId, Long applicationId) {
        return workSessionRepository
                .findFirstByApplicationIdAndClockOutAtIsNull(applicationId)
                .filter(ws -> ws.getApplication().getCandidate().getId().equals(candidateId))
                .map(this::toDto)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<WorkSessionDto> listForApplication(Long applicationId, Long candidateId) {
        return workSessionRepository.findByApplicationIdOrderByClockInAtDesc(applicationId)
                .stream()
                .filter(ws -> ws.getApplication().getCandidate().getId().equals(candidateId))
                .map(this::toDto)
                .toList();
    }

    // ─── helpers ─────────────────────────────────────────────────────────

    private void validateApplication(Application app, Long candidateId) {
        if (!app.getCandidate().getId().equals(candidateId)) {
            throw UnauthorizedException.keyed("error.application.notOwner");
        }
        if (app.getStatus() != ApplicationStatus.ACCEPTED) {
            throw new BusinessRuleException(
                    "Mesai kaydı yalnız kabul edilmiş başvurularda yapılabilir.");
        }
    }

    /** Haversine — iki GPS noktasi arasi mesafe (metre, yaklasik). */
    private int haversineMeters(BigDecimal lat1, BigDecimal lng1,
                                 BigDecimal lat2, BigDecimal lng2) {
        double r1 = Math.toRadians(lat1.doubleValue());
        double r2 = Math.toRadians(lat2.doubleValue());
        double dLat = Math.toRadians(lat2.subtract(lat1).doubleValue());
        double dLng = Math.toRadians(lng2.subtract(lng1).doubleValue());
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                 + Math.cos(r1) * Math.cos(r2)
                 * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return (int) Math.round(EARTH_RADIUS_M * c);
    }

    private long durationMinutes(WorkSession ws) {
        if (ws.getClockOutAt() == null) return 0;
        return Duration.between(ws.getClockInAt(), ws.getClockOutAt()).toMinutes();
    }

    private WorkSessionDto toDto(WorkSession ws) {
        Application app = ws.getApplication();
        return WorkSessionDto.builder()
                .id(ws.getId())
                .applicationId(app.getId())
                .listingTitle(app.getJobListing().getTitle())
                .businessName(app.getJobListing().getBusiness().getName())
                .clockInAt(ws.getClockInAt())
                .clockInDistanceMeters(ws.getClockInDistanceMeters())
                .clockOutAt(ws.getClockOutAt())
                .clockOutDistanceMeters(ws.getClockOutDistanceMeters())
                .durationMinutes(durationMinutes(ws))
                .build();
    }

    @Data @Builder
    public static class WorkSessionDto {
        private Long id;
        private Long applicationId;
        private String listingTitle;
        private String businessName;
        private LocalDateTime clockInAt;
        private Integer clockInDistanceMeters;
        private LocalDateTime clockOutAt;
        private Integer clockOutDistanceMeters;
        private long durationMinutes;
    }
}
