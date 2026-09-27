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
 * QR ancak kişi kapıdayken görevlinin telefonuyla okutulabildiği için uzaktan
 * "geldi" gösterilemez. Telefonu olmayanı işletme listeden "Geldi" ile işaretler.
 *
 * Token: base64url("pass:{applicationId}:{yyyy-MM-dd}") + "." + HMAC-SHA256 (ilk 16 bayt).
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

    // ── Token (başvuru + vardiya günü) ─────────────────────────────────

    String tokenFor(Long applicationId, LocalDate shiftDate) {
        String payload = "pass:" + applicationId + ":" + shiftDate;
        String p = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return p + "." + sign(payload);
    }

    record Parsed(Long applicationId, LocalDate shiftDate) {}

    Parsed parse(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 2) throw new IllegalArgumentException();
            String payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            if (!MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.UTF_8),
                                       parts[1].getBytes(StandardCharsets.UTF_8))) {
                throw new IllegalArgumentException();
            }
            String[] f = payload.split(":");
            if (f.length != 3 || !"pass".equals(f[0])) throw new IllegalArgumentException();
            return new Parsed(Long.valueOf(f[1]), LocalDate.parse(f[2]));
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
        LocalDate today = LocalDate.now(clock);
        return applicationRepository.findAllByCandidateId(candidateId).stream()
                .filter(a -> a.getStatus() == ApplicationStatus.ACCEPTED)
                .flatMap(a -> a.getRequestedSlots().stream()
                        .filter(s -> isCurrent(s, today))
                        .min(Comparator.comparing(ShiftSlot::getStartTime))
                        .stream()
                        .map(s -> toPass(a, s)))
                .sorted(Comparator.comparing(PassDto::getShift))
                .toList();
    }

    private PassDto toPass(Application a, ShiftSlot s) {
        JobListing l = a.getJobListing();
        WorkSession used = sessionOn(a.getId(), s.getDate(), overnight(s)).orElse(null);
        return PassDto.builder()
                .applicationId(a.getId())
                .fullName(a.getCandidate().getFullName())
                .businessName(l.getBusiness().getName())
                .listingTitle(l.getTitle())
                .shiftDate(s.getDate())
                .shift(T.format(s.getStartTime()) + " – " + T.format(s.getEndTime()))
                .meetingPoint(l.getMeetingPoint())
                .meetingMinutesBefore(l.getMeetingMinutesBefore())
                .passUrl(baseUrl.replaceAll("/$", "") + "/giris/" + tokenFor(a.getId(), s.getDate()))
                .usedAt(used == null ? null : used.getClockInAt())
                .build();
    }

    // ── Görevli (işletme hesabı): kartı okut ───────────────────────────

    @Transactional
    public ScanResult scan(String token, Long ownerId) {
        Parsed p = parse(token);
        Application app = applicationRepository.findById(p.applicationId())
                .orElseThrow(() -> new BusinessRuleException("Giriş kartı geçersiz"));
        if (!app.getJobListing().getBusiness().getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Bu kart senin işletmene ait değil");
        }
        if (app.getStatus() != ApplicationStatus.ACCEPTED) {
            throw new BusinessRuleException("Bu çalışanın başvurusu artık kabul edilmiş durumda değil");
        }
        ShiftSlot slot = app.getRequestedSlots().stream()
                .filter(s -> s.getDate().equals(p.shiftDate()))
                .min(Comparator.comparing(ShiftSlot::getStartTime))
                .orElseThrow(() -> new BusinessRuleException("Bu kartın vardiyası bulunamadı"));
        if (!isCurrent(slot, LocalDate.now(clock))) {
            throw new BusinessRuleException("Bu kart " + p.shiftDate() + " vardiyası için — bugün geçerli değil");
        }

        // Tek kullanımlık: aynı vardiya günü için ikinci okutma yeni kayıt açmaz
        WorkSession ws = sessionOn(app.getId(), slot.getDate(), overnight(slot)).orElse(null);
        boolean alreadyUsed = ws != null;
        if (ws == null) {
            ws = workSessionRepository.save(WorkSession.builder()
                    .application(app).clockInAt(LocalDateTime.now(clock)).build());
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
    public void manualCheckIn(Long applicationId, Long ownerId) {
        Application app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException("Başvuru", applicationId));
        if (!app.getJobListing().getBusiness().getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Bu başvuru senin ilanına ait değil");
        }
        if (app.getStatus() != ApplicationStatus.ACCEPTED) {
            throw new BusinessRuleException("Sadece kabul edilmiş aday yoklamaya eklenebilir");
        }
        LocalDate today = LocalDate.now(clock);
        if (sessionOn(app.getId(), today, false).isEmpty()) {
            workSessionRepository.save(WorkSession.builder()
                    .application(app).clockInAt(LocalDateTime.now(clock)).build());
            log.info("[CHECKIN-MANUAL] appId={} owner={}", app.getId(), ownerId);
        }
    }

    // ── Yardımcılar ────────────────────────────────────────────────────

    /** Bugünün vardiyası ya da dün başlayıp gece yarısını geçen (22:00–06:00 gibi) vardiya. */
    static boolean isCurrent(ShiftSlot s, LocalDate today) {
        if (today.equals(s.getDate())) return true;
        return today.minusDays(1).equals(s.getDate()) && overnight(s);
    }

    /**
     * Vardiyaya ait giriş kaydı: vardiya günü açılan kayıt; gece vardiyasında
     * (22:00–06:00) ertesi gün öğlene kadar açılan kayıt da sayılır.
     */
    private Optional<WorkSession> sessionOn(Long applicationId, LocalDate shiftDate, boolean overnight) {
        return workSessionRepository.findByApplicationIdOrderByClockInAtDesc(applicationId).stream()
                .filter(w -> w.getClockInAt() != null)
                .filter(w -> {
                    LocalDate d = w.getClockInAt().toLocalDate();
                    if (d.equals(shiftDate)) return true;
                    return overnight && d.equals(shiftDate.plusDays(1))
                            && w.getClockInAt().toLocalTime().isBefore(java.time.LocalTime.NOON);
                })
                .findFirst();
    }

    private static boolean overnight(ShiftSlot s) {
        return s.getEndTime() != null && s.getStartTime() != null && s.getEndTime().isBefore(s.getStartTime());
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
