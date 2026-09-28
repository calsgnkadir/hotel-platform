package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.User;
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
 * Giriş kartı (kişisel, tek kullanımlık QR).
 *
 * Kabul edilen çalışanın uygulamasında vardiya günü o vardiyaya özel bir QR
 * çıkar. Kapıdaki otel görevlisi kendi telefon kamerasıyla okutur →
 * {baseUrl}/giris/{token} açılır (işletme hesabıyla) → giriş saati yazılır ve
 * çalışanın adı + fotoğrafı gösterilir (görevli yüzü karşılaştırır). Aynı kart
 * aynı gün ikinci kez okutulursa "zaten kullanıldı" döner — yeni kayıt açılmaz.
 * Görevli kimliği yüz/fotoğraf ile kontrol etmelidir; QR fiziksel mevcudiyet
 * kanıtı değildir. Telefonu olmayanı işletme listeden "Geldi" ile işaretler.
 *
 * Token: base64url("pass2:{applicationId}:{slotId}:{yyyy-MM-dd}") + "." + HMAC-SHA256.
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
    private final FileStorageService fileStorageService;

    @Value("${jwt.secret}")
    private String secret;

    @Value("${app.base-url:http://localhost:5173}")
    private String baseUrl;

    /** Testte saat sabitlenebilsin diye. */
    Clock clock = Clock.system(TR);

    // ── Token (başvuru + vardiya + gün) ────────────────────────────────

    String tokenFor(Long applicationId, LocalDate shiftDate) {
        return signedToken("pass:" + applicationId + ":" + shiftDate);
    }

    String tokenFor(Long applicationId, Long slotId, LocalDate shiftDate) {
        return signedToken("pass2:" + applicationId + ":" + slotId + ":" + shiftDate);
    }

    private String signedToken(String payload) {
        String p = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return p + "." + sign(payload);
    }

    record Parsed(Long applicationId, Long slotId, LocalDate shiftDate) {}

    Parsed parse(String token) {
        try {
            String[] parts = token.split("\\.", -1);
            if (parts.length != 2) throw new IllegalArgumentException();
            String payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            if (!MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.UTF_8),
                                       parts[1].getBytes(StandardCharsets.UTF_8))) {
                throw new IllegalArgumentException();
            }
            String[] f = payload.split(":");
            if (f.length == 4 && "pass2".equals(f[0])) {
                return new Parsed(Long.valueOf(f[1]), Long.valueOf(f[2]), LocalDate.parse(f[3]));
            }
            // Already issued cards remain usable only when their date identifies one shift.
            if (f.length == 3 && "pass".equals(f[0])) {
                return new Parsed(Long.valueOf(f[1]), null, LocalDate.parse(f[2]));
            }
            throw new IllegalArgumentException();
        } catch (RuntimeException e) {
            throw new BusinessRuleException("Giriş kartı geçersiz");
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

    // ── Çalışan: bugünkü giriş kartlarım ───────────────────────────────

    @Transactional(readOnly = true)
    public List<PassDto> myPasses(Long candidateId) {
        LocalDateTime now = LocalDateTime.now(clock);
        return applicationRepository.findAllByCandidateId(candidateId).stream()
                .filter(a -> a.getStatus() == ApplicationStatus.ACCEPTED)
                .flatMap(a -> a.getRequestedSlots().stream()
                        .filter(s -> ShiftAttendance.isCurrent(s, now))
                        .map(s -> toPass(a, s)))
                .sorted(Comparator.comparing(PassDto::getShiftDate).thenComparing(PassDto::getShift))
                .toList();
    }

    private PassDto toPass(Application a, ShiftSlot s) {
        JobListing l = a.getJobListing();
        WorkSession used = sessionOn(a, s).orElse(null);
        return PassDto.builder()
                .applicationId(a.getId())
                .shiftSlotId(s.getId())
                .fullName(a.getCandidate().getFullName())
                .businessName(l.getBusiness().getName())
                .listingTitle(l.getTitle())
                .shiftDate(s.getDate())
                .shift(T.format(s.getStartTime()) + " – " + T.format(s.getEndTime()))
                .meetingPoint(l.getMeetingPoint())
                .meetingMinutesBefore(l.getMeetingMinutesBefore())
                .passUrl(baseUrl.replaceAll("/$", "") + "/giris/" + tokenFor(a.getId(), s.getId(), s.getDate()))
                .usedAt(used == null ? null : used.getClockInAt())
                .build();
    }

    // ── Görevli (işletme hesabı): kartı okut ───────────────────────────

    @Transactional
    public ScanResult scan(String token, Long ownerId) {
        Parsed p = parse(token);
        Application app = applicationRepository.findByIdForCheckIn(p.applicationId())
                .orElseThrow(() -> new BusinessRuleException("Giriş kartı geçersiz"));
        if (!app.getJobListing().getBusiness().getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Bu kart senin işletmene ait değil");
        }
        if (app.getStatus() != ApplicationStatus.ACCEPTED) {
            throw new BusinessRuleException("Bu çalışanın başvurusu artık kabul edilmiş durumda değil");
        }
        List<ShiftSlot> matching = app.getRequestedSlots().stream()
                .filter(s -> s.getDate().equals(p.shiftDate()))
                .filter(s -> p.slotId() == null || s.getId().equals(p.slotId())).toList();
        if (matching.size() != 1) {
            throw new BusinessRuleException("Kartın vardiyası belirlenemedi — giriş kartını yeniden aç");
        }
        ShiftSlot slot = matching.get(0);
        LocalDateTime now = LocalDateTime.now(clock);
        if (!ShiftAttendance.isCurrent(slot, now)) {
            throw new BusinessRuleException("Bu kart " + p.shiftDate() + " vardiyası için — şu anda geçerli değil");
        }

        // The application lock and unique (application, shift) constraint protect all entry paths.
        WorkSession ws = sessionOn(app, slot).orElse(null);
        boolean alreadyUsed = ws != null;
        if (ws == null) {
            ws = workSessionRepository.save(WorkSession.builder()
                    .application(app).shiftSlotId(slot.getId()).clockInAt(now).build());
            log.info("[PASS-SCAN] appId={} owner={}", app.getId(), ownerId);
        }
        User c = app.getCandidate();
        return ScanResult.builder()
                .applicationId(app.getId())
                .fullName(c.getFullName())
                .photoUrl(c.getAvatarPath() == null ? null : fileStorageService.publicUrl(c.getAvatarPath()))
                .listingTitle(app.getJobListing().getTitle())
                .shift(T.format(slot.getStartTime()) + " – " + T.format(slot.getEndTime()))
                .clockInAt(ws.getClockInAt())
                .alreadyUsed(alreadyUsed)
                .build();
    }

    // ── İşletme: yoklama ekranı + elle "geldi" ─────────────────────────

    @Transactional(readOnly = true)
    public AttendanceDto attendance(Long listingId, Long ownerId, LocalDate date) {
        JobListing l = ownedListing(listingId, ownerId);
        LocalDate d = date != null ? date : LocalDate.now(clock);
        List<RosterRow> rows = rosterService.collectRows(l, d).getOrDefault(d, List.of());
        long arrived = rows.stream().filter(r -> !r.clockIn().isEmpty()).count();
        return AttendanceDto.builder()
                .listingId(l.getId())
                .listingTitle(l.getTitle())
                .businessName(l.getBusiness().getName())
                .date(d)
                .meetingPoint(l.getMeetingPoint())
                .meetingMinutesBefore(l.getMeetingMinutesBefore())
                .expected(rows.size())
                .arrived((int) arrived)
                .rows(rows)
                .build();
    }

    /** Telefonu olmayan / kartını açamayan çalışanı listeden "geldi" işaretle. */
    @Transactional
    public void manualCheckIn(Long applicationId, Long ownerId, Long slotId) {
        Application app = applicationRepository.findByIdForCheckIn(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));
        if (!app.getJobListing().getBusiness().getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Bu başvuru senin ilanına ait değil");
        }
        if (app.getStatus() != ApplicationStatus.ACCEPTED) {
            throw new BusinessRuleException("Sadece kabul edilmiş aday yoklamaya eklenebilir");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        List<ShiftSlot> matching = app.getRequestedSlots().stream()
                .filter(s -> slotId == null || s.getId().equals(slotId))
                .filter(s -> ShiftAttendance.isCurrent(s, now)).toList();
        if (matching.size() != 1) {
            throw new BusinessRuleException("Geçerli tek bir vardiya seçmelisin");
        }
        ShiftSlot slot = matching.get(0);
        if (sessionOn(app, slot).isEmpty()) {
            workSessionRepository.save(WorkSession.builder()
                    .application(app).shiftSlotId(slot.getId()).clockInAt(now).build());
            log.info("[CHECKIN-MANUAL] appId={} owner={}", app.getId(), ownerId);
        }
    }

    // ── Yardımcılar ────────────────────────────────────────────────────

    private Optional<WorkSession> sessionOn(Application app, ShiftSlot slot) {
        return ShiftAttendance.sessionFor(app, slot,
                workSessionRepository.findByApplicationIdOrderByClockInAtDesc(app.getId()));
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
    public static class PassDto {
        private Long applicationId;
        private Long shiftSlotId;
        private String fullName;
        private String businessName;
        private String listingTitle;
        private LocalDate shiftDate;
        private String shift;
        private String meetingPoint;
        private Integer meetingMinutesBefore;
        /** QR içeriği: görevli okutunca açılan link. */
        private String passUrl;
        /** Okutulduysa giriş saati (kart kullanıldı). */
        private LocalDateTime usedAt;
    }

    @Data @Builder
    public static class ScanResult {
        private Long applicationId;
        private String fullName;
        /** Görevli yüzü karşılaştırsın diye (yoksa null). */
        private String photoUrl;
        private String listingTitle;
        private String shift;
        private LocalDateTime clockInAt;
        /** true → kart bu vardiya için daha önce okutulmuş (yeni kayıt açılmadı). */
        private boolean alreadyUsed;
    }

    @Data @Builder
    public static class AttendanceDto {
        private Long listingId;
        private String listingTitle;
        private String businessName;
        private LocalDate date;
        private String meetingPoint;
        private Integer meetingMinutesBefore;
        private int expected;
        private int arrived;
        private List<RosterRow> rows;
    }
}
