package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
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
 * FAZ 2/#21 — Geo-fenced clock-in / clock-out.
 *
 * Aday "Mesaiye Basla" basinca GPS koordinati gelir, isletmenin konumuyla
 * Haversine formulu ile metre cinsinden mesafe hesaplanir. 200m disindaysa
 * reddedilir. Acik session varsa once "bitir" denmeli (UI'da gosterilir).
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

    @Transactional
    public WorkSessionDto clockIn(Long candidateId, Long applicationId,
                                   BigDecimal lat, BigDecimal lng) {
        Application app = getOwnedAcceptedApplication(applicationId, candidateId);
        Business biz = app.getJobListing().getBusiness();

        // Isletme konumu yoksa fence yapilamaz
        if (biz.getLatitude() == null || biz.getLongitude() == null) {
            throw new BusinessRuleException(
                    "Isletmenin konumu sisteme girilmedi — clock-in yapilamaz");
        }

        int distance = haversineMeters(
                lat, lng, biz.getLatitude(), biz.getLongitude());

        if (distance > FENCE_RADIUS_METERS) {
            throw new BusinessRuleException(String.format(
                    "Isyerinden cok uzaktasin (~%d m). Maksimum %d m olmali.",
                    distance, FENCE_RADIUS_METERS));
        }

        // Aday'in baska acik session'i olmamali (overlapping nokta isi)
        List<WorkSession> openSessions =
                workSessionRepository.findByApplicationCandidateIdAndClockOutAtIsNull(candidateId);
        if (!openSessions.isEmpty()) {
            throw new BusinessRuleException(
                    "Zaten acik bir mesain var. Once 'Mesaiyi Bitir' yapmalisin.");
        }

        WorkSession ws = WorkSession.builder()
                .application(app)
                .clockInAt(LocalDateTime.now())
                .clockInLat(lat)
                .clockInLng(lng)
                .clockInDistanceMeters(distance)
                .build();
        workSessionRepository.save(ws);
        log.info("[WS-CLOCK-IN] appId={} candId={} dist={}m", applicationId, candidateId, distance);
        return toDto(ws);
    }

    @Transactional
    public WorkSessionDto clockOut(Long candidateId, Long applicationId,
                                    BigDecimal lat, BigDecimal lng) {
        Application app = getOwnedAcceptedApplication(applicationId, candidateId);
        Business biz = app.getJobListing().getBusiness();

        WorkSession ws = workSessionRepository
                .findFirstByApplicationIdAndClockOutAtIsNull(applicationId)
                .orElseThrow(() -> new BusinessRuleException(
                        "Acik bir mesain yok — once 'Mesaiye Basla' yap"));

        int distance = (biz.getLatitude() != null && biz.getLongitude() != null)
                ? haversineMeters(lat, lng, biz.getLatitude(), biz.getLongitude())
                : -1;
        // Cikis icin fence kontrolu yumusak: mesafe loglanir ama reddedilmez
        // (aday yorgun gelmis olabilir, "bitir" niyetini blokladmamali)
        if (distance > FENCE_RADIUS_METERS) {
            log.warn("[WS-CLOCK-OUT] uzak cikis kabul edildi: appId={} dist={}m", applicationId, distance);
        }

        ws.setClockOutAt(LocalDateTime.now());
        ws.setClockOutLat(lat);
        ws.setClockOutLng(lng);
        ws.setClockOutDistanceMeters(distance);
        workSessionRepository.save(ws);
        log.info("[WS-CLOCK-OUT] appId={} candId={} dist={}m duration={}min",
                applicationId, candidateId, distance, durationMinutes(ws));
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

    private Application getOwnedAcceptedApplication(Long appId, Long candidateId) {
        Application app = applicationRepository.findById(appId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", appId));
        if (!app.getCandidate().getId().equals(candidateId)) {
            throw new UnauthorizedException("Bu basvuru size ait degil");
        }
        if (app.getStatus() != ApplicationStatus.ACCEPTED) {
            throw new BusinessRuleException(
                    "Mesai kaydedebilmek icin basvurun ACCEPTED olmali. Mevcut: " + app.getStatus());
        }
        return app;
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
