package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.WorkSession;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.WorkSessionRepository;
import com.hotelapp.service.RosterService.RosterRow;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Toplu vardiya yoklaması (QR).
 *
 * İşletme toplanma noktasında ilanın o güne ait QR'ını gösterir/asar. Aday
 * telefon kamerasıyla okutur → {baseUrl}/checkin/{token} açılır → giriş kaydı
 * (WorkSession) oluşur. GPS gerekmez: QR'ın o noktada olması varlık kanıtı.
 * Telefonu olmayan/okutamayan için ekip başı yoklama ekranından elle işaretler.
 *
 * Token: base64url("listingId:yyyy-MM-dd") + "." + HMAC-SHA256 (ilk 16 bayt).
 * Sadece o gün geçerli; başka ilana/güne kopyalanamaz.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CheckInService {

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final DateTimeFormatter T = DateTimeFormatter.ofPattern("HH:mm");

    private final JobListingRepository jobListingRepository;
    private final ApplicationRepository applicationRepository;
    private final WorkSessionRepository workSessionRepository;
    private final RosterService rosterService;

    @Value("${jwt.secret}")
    private String secret;

    @Value("${app.base-url:http://localhost:5173}")
    private String baseUrl;

    /** Testte saat sabitlenebilsin diye. */
    Clock clock = Clock.system(TR);

    // ── Token ──────────────────────────────────────────────────────────

    String tokenFor(Long listingId, LocalDate date) {
        return encode(listingId + ":" + date);
    }

    /** Ekip başı linki: aynı anahtar, farklı payload → QR belirteci yerine kullanılamaz (ve tersi). */
    String leadTokenFor(Long listingId, LocalDate date) {
        return encode("lead:" + listingId + ":" + date);
    }

    private String encode(String payload) {
        String p = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return p + "." + sign(payload);
    }

    /** Geçerliyse [listingId, date]; değilse BusinessRuleException. */
    record Parsed(Long listingId, LocalDate date) {}

    Parsed parse(String token) {
        String[] f = verified(token, "QR kodu geçersiz").split(":");
        if (f.length != 2) throw new BusinessRuleException("QR kodu geçersiz");
        return new Parsed(Long.valueOf(f[0]), LocalDate.parse(f[1]));
    }

    Parsed parseLead(String token) {
        String[] f = verified(token, "Ekip başı linki geçersiz").split(":");
        if (f.length != 3 || !"lead".equals(f[0])) throw new BusinessRuleException("Ekip başı linki geçersiz");
        return new Parsed(Long.valueOf(f[1]), LocalDate.parse(f[2]));
    }

    /** İmzayı ve biçimi doğrular, payload'u döner; bozuksa verilen mesajla hata. */
    private String verified(String token, String error) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 2) throw new IllegalArgumentException();
            String payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            if (!MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.UTF_8),
                                       parts[1].getBytes(StandardCharsets.UTF_8))) {
                throw new IllegalArgumentException();
            }
            String[] f = payload.split(":");
            LocalDate.parse(f[f.length - 1]);
            Long.valueOf(f[f.length - 2]);
            return payload;
        } catch (RuntimeException e) {
            throw new BusinessRuleException(error);
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(("checkin:" + secret).getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] full = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(java.util.Arrays.copyOf(full, 16));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    // ── İşletme: yoklama ekranı ────────────────────────────────────────

    @Transactional(readOnly = true)
    public AttendanceDto attendance(Long listingId, Long ownerId, LocalDate date) {
        JobListing l = ownedListing(listingId, ownerId);
        LocalDate d = date != null ? date : LocalDate.now(clock);
        AttendanceDto dto = build(l, d);
        dto.setLeadUrl(base() + "/ekip/" + leadTokenFor(l.getId(), d));
        return dto;
    }

    /** Ekip başı (hesapsız, linkle): o ilanın o günkü yoklaması. Geçmiş günün linki çalışmaz. */
    @Transactional(readOnly = true)
    public AttendanceDto attendanceForLead(String leadToken) {
        Parsed p = parseLead(leadToken);
        if (p.date().isBefore(LocalDate.now(clock))) {
            throw new BusinessRuleException("Bu ekip başı linkinin süresi doldu");
        }
        JobListing l = jobListingRepository.findById(p.listingId())
                .orElseThrow(() -> new ResourceNotFoundException("İlan", p.listingId()));
        return build(l, p.date());
    }

    /** Ekip başı linkiyle elle "geldi": sadece o gün, sadece o ilanın başvurusu. */
    @Transactional
    public void manualCheckInByLead(String leadToken, Long applicationId) {
        Parsed p = parseLead(leadToken);
        if (!p.date().equals(LocalDate.now(clock))) {
            throw new BusinessRuleException("Yoklama sadece vardiya günü alınabilir");
        }
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));
        if (!app.getJobListing().getId().equals(p.listingId())) {
            throw new UnauthorizedException("Bu aday bu ilanın ekibinde değil");
        }
        markArrived(app, "lead");
    }

    private String base() {
        return baseUrl.replaceAll("/$", "");
    }

    private AttendanceDto build(JobListing l, LocalDate d) {
        List<RosterRow> rows = rosterService.collectRows(l, d).getOrDefault(d, List.of());
        long arrived = rows.stream().filter(r -> !r.clockIn().isEmpty()).count();
        String token = tokenFor(l.getId(), d);
        return AttendanceDto.builder()
                .listingId(l.getId())
                .listingTitle(l.getTitle())
                .date(d)
                .meetingPoint(l.getMeetingPoint())
                .meetingMinutesBefore(l.getMeetingMinutesBefore())
                .checkinUrl(base() + "/checkin/" + token)
                .expected(rows.size())
                .arrived((int) arrived)
                .rows(rows)
                .build();
    }

    /** Ekip başı: telefonu olmayan / okutamayan adayı elle "geldi" işaretler. */
    @Transactional
    public void manualCheckIn(Long applicationId, Long ownerId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));
        if (!app.getJobListing().getBusiness().getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Bu başvuru senin ilanına ait değil");
        }
        markArrived(app, "owner:" + ownerId);
    }

    private void markArrived(Application app, String by) {
        if (app.getStatus() != ApplicationStatus.ACCEPTED) {
            throw new BusinessRuleException("Sadece kabul edilmiş aday yoklamaya eklenebilir");
        }
        LocalDate today = LocalDate.now(clock);
        if (todaysSession(app.getId(), today).isEmpty()) {
            workSessionRepository.save(WorkSession.builder()
                    .application(app).clockInAt(LocalDateTime.now(clock)).build());
            log.info("[CHECKIN-MANUAL] appId={} by={}", app.getId(), by);
        }
    }

    // ── Aday: QR okut ──────────────────────────────────────────────────

    @Transactional
    public CheckInResult checkIn(String token, Long candidateId) {
        Parsed p = parse(token);
        LocalDate today = LocalDate.now(clock);
        if (!p.date().equals(today)) {
            throw new BusinessRuleException("Bu QR kodu " + p.date() + " tarihi için — bugün geçerli değil");
        }
        JobListing l = jobListingRepository.findById(p.listingId())
                .orElseThrow(() -> new ResourceNotFoundException("İlan", p.listingId()));

        Application app = applicationRepository.findAllByJobListingId(l.getId()).stream()
                .filter(a -> a.getCandidate().getId().equals(candidateId))
                .filter(a -> a.getStatus() == ApplicationStatus.ACCEPTED)
                .findFirst()
                .orElseThrow(() -> new BusinessRuleException(
                        "Bu ilanda kabul edilmiş bir başvurun yok — işletmeyle konuş"));

        ShiftSlot slot = app.getRequestedSlots().stream()
                .filter(s -> today.equals(s.getDate()))
                .min(Comparator.comparing(ShiftSlot::getStartTime))
                .orElse(null);
        if (!app.getRequestedSlots().isEmpty() && slot == null) {
            throw new BusinessRuleException("Bugün bu ilanda vardiyan görünmüyor");
        }

        // Aynı gün ikinci okutma: mevcut girişi döndür (idempotent)
        WorkSession ws = todaysSession(app.getId(), today).orElse(null);
        boolean already = ws != null;
        if (ws == null) {
            if (!workSessionRepository.findByApplicationCandidateIdAndClockOutAtIsNull(candidateId).isEmpty()) {
                throw new BusinessRuleException("Başka bir işte açık mesain var — önce onu bitir");
            }
            ws = workSessionRepository.save(WorkSession.builder()
                    .application(app).clockInAt(LocalDateTime.now(clock)).build());
            log.info("[CHECKIN-QR] appId={} candId={} listing={}", app.getId(), candidateId, l.getId());
        }

        return CheckInResult.builder()
                .applicationId(app.getId())
                .listingTitle(l.getTitle())
                .businessName(l.getBusiness().getName())
                .clockInAt(ws.getClockInAt())
                .alreadyCheckedIn(already)
                .shift(slot == null ? null : T.format(slot.getStartTime()) + " – " + T.format(slot.getEndTime()))
                .meetingPoint(l.getMeetingPoint())
                .build();
    }

    private Optional<WorkSession> todaysSession(Long applicationId, LocalDate day) {
        return workSessionRepository.findByApplicationIdOrderByClockInAtDesc(applicationId).stream()
                .filter(w -> w.getClockInAt() != null && w.getClockInAt().toLocalDate().equals(day))
                .findFirst();
    }

    private JobListing ownedListing(Long listingId, Long ownerId) {
        JobListing l = jobListingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("İlan", listingId));
        if (!l.getBusiness().getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Bu ilanın yoklamasını göremezsin");
        }
        return l;
    }

    @Data @Builder
    public static class AttendanceDto {
        private Long listingId;
        private String listingTitle;
        private LocalDate date;
        private String meetingPoint;
        private Integer meetingMinutesBefore;
        private String checkinUrl;
        /** Sadece işletmeye döner: ekip başına WhatsApp'tan gönderilecek hesapsız link. */
        private String leadUrl;
        private int expected;
        private int arrived;
        private List<RosterRow> rows;
    }

    @Data @Builder
    public static class CheckInResult {
        private Long applicationId;
        private String listingTitle;
        private String businessName;
        private LocalDateTime clockInAt;
        private boolean alreadyCheckedIn;
        private String shift;
        private String meetingPoint;
    }
}
