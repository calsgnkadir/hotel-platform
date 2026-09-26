package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.Business;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.entity.WorkSession;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.BusinessRepository;
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
import java.text.Normalizer;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Giriş yoklaması (QR).
 *
 * Her işletmenin KALICI tek bir QR'ı var — personel girişine bir kez basılıp
 * asılır. Okutan kişi {baseUrl}/checkin/{token} sayfasına düşer:
 *  - Aday hesabıyla girişliyse: bugünkü kabul edilmiş vardiyası bulunur, giriş yazılır.
 *  - Değilse: ad soyad sorulur; bugünün ekip listesinde (kabul edilmiş + bugün
 *    vardiyası olan) eşleşme varsa giriş yazılır. Aynı isimden birden fazla
 *    kişi varsa telefonun son 4 hanesi istenir.
 * Telefonu olmayanı işletme yoklama ekranından "Geldi" ile işaretler.
 *
 * Token: base64url("biz:{businessId}") + "." + HMAC-SHA256 (ilk 16 bayt).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CheckInService {

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final DateTimeFormatter T = DateTimeFormatter.ofPattern("HH:mm");
    private static final Locale TR_LOCALE = Locale.forLanguageTag("tr");

    private final JobListingRepository jobListingRepository;
    private final BusinessRepository businessRepository;
    private final ApplicationRepository applicationRepository;
    private final WorkSessionRepository workSessionRepository;
    private final RosterService rosterService;

    @Value("${jwt.secret}")
    private String secret;

    @Value("${app.base-url:http://localhost:5173}")
    private String baseUrl;

    /** Testte saat sabitlenebilsin diye. */
    Clock clock = Clock.system(TR);

    // ── Token (işletme başına kalıcı) ──────────────────────────────────

    String tokenFor(Long businessId) {
        String payload = "biz:" + businessId;
        String p = Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        return p + "." + sign(payload);
    }

    /** Geçerliyse businessId; değilse BusinessRuleException. */
    Long parse(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 2) throw new IllegalArgumentException();
            String payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            if (!MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.UTF_8),
                                       parts[1].getBytes(StandardCharsets.UTF_8))
                    || !payload.startsWith("biz:")) {
                throw new IllegalArgumentException();
            }
            return Long.valueOf(payload.substring(4));
        } catch (RuntimeException e) {
            throw new BusinessRuleException("QR kodu geçersiz");
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

    public String checkinUrlFor(Long businessId) {
        return baseUrl.replaceAll("/$", "") + "/checkin/" + tokenFor(businessId);
    }

    // ── İşletme: yoklama ekranı ────────────────────────────────────────

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
                .checkinUrl(checkinUrlFor(l.getBusiness().getId()))
                .expected(rows.size())
                .arrived((int) arrived)
                .rows(rows)
                .build();
    }

    /** İşletme: telefonu olmayan / okutamayan adayı elle "geldi" işaretler. */
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
        if (todaysSession(app.getId(), today).isEmpty()) {
            workSessionRepository.save(WorkSession.builder()
                    .application(app).clockInAt(LocalDateTime.now(clock)).build());
            log.info("[CHECKIN-MANUAL] appId={} owner={}", app.getId(), ownerId);
        }
    }

    // ── QR okutma ──────────────────────────────────────────────────────

    /** QR sayfası başlığı için: hangi işletme (herkese açık, sadece ad). */
    @Transactional(readOnly = true)
    public String businessNameFor(String token) {
        Long businessId = parse(token);
        return businessRepository.findById(businessId).map(Business::getName)
                .orElseThrow(() -> new BusinessRuleException("QR kodu geçersiz"));
    }

    /** Aday hesabıyla girişli okutma: bugünkü vardiyası otomatik bulunur. */
    @Transactional
    public CheckInResult checkIn(String token, Long candidateId) {
        Long businessId = parse(token);
        List<Todays> mine = todaysTeam(businessId).stream()
                .filter(t -> t.app().getCandidate().getId().equals(candidateId))
                .toList();
        if (mine.isEmpty()) {
            throw new BusinessRuleException("Bugün bu işletmede kabul edilmiş bir vardiyan görünmüyor — işletmeyle konuş");
        }
        return record(mine.get(0), candidateId);
    }

    /**
     * Hesapsız okutma: ad soyad ile bugünün listesinde ara. Aynı isimden birden
     * fazla kişi varsa telefonun son 4 hanesi gerekir (needPhone=true döner).
     */
    @Transactional
    public CheckInResult checkInByName(String token, String fullName, String phoneLast4) {
        Long businessId = parse(token);
        String wanted = normalize(fullName);
        if (wanted.length() < 3) throw new BusinessRuleException("Adını ve soyadını yaz");

        List<Todays> matches = todaysTeam(businessId).stream()
                .filter(t -> normalize(t.app().getCandidate().getFullName()).equals(wanted))
                .toList();
        if (matches.isEmpty()) {
            throw new BusinessRuleException("Bugünün listesinde bu isim yok — adını listedeki gibi yaz ya da işletmeye söyle");
        }
        if (matches.size() > 1) {
            String digits = phoneLast4 == null ? "" : phoneLast4.replaceAll("\\D", "");
            if (digits.length() != 4) {
                return CheckInResult.builder().needPhone(true).build();
            }
            matches = matches.stream()
                    .filter(t -> {
                        String p = t.app().getCandidate().getPhone();
                        return p != null && p.replaceAll("\\D", "").endsWith(digits);
                    })
                    .toList();
            if (matches.size() != 1) {
                throw new BusinessRuleException("Telefon numarası eşleşmedi — işletmeye söyle");
            }
        }
        return record(matches.get(0), matches.get(0).app().getCandidate().getId());
    }

    /** Bugün bu işletmede çalışacak ekip: kabul edilmiş + bugün vardiyası olan. */
    private record Todays(Application app, ShiftSlot slot) {}

    private List<Todays> todaysTeam(Long businessId) {
        LocalDate today = LocalDate.now(clock);
        return applicationRepository
                .findAllByJobListing_Business_IdAndStatus(businessId, ApplicationStatus.ACCEPTED).stream()
                .map(a -> new Todays(a, a.getRequestedSlots().stream()
                        .filter(s -> isCurrent(s, today))
                        .min(Comparator.comparing(ShiftSlot::getStartTime))
                        .orElse(null)))
                .filter(t -> t.slot() != null)
                .sorted(Comparator.comparing(t -> t.slot().getStartTime()))
                .toList();
    }

    /** Bugünün vardiyası ya da dün başlayıp gece yarısını geçen (22:00–06:00 gibi) vardiya. */
    private static boolean isCurrent(ShiftSlot s, LocalDate today) {
        if (today.equals(s.getDate())) return true;
        return today.minusDays(1).equals(s.getDate())
                && s.getEndTime() != null && s.getStartTime() != null
                && s.getEndTime().isBefore(s.getStartTime());
    }

    private CheckInResult record(Todays t, Long candidateId) {
        Application app = t.app();
        LocalDate today = LocalDate.now(clock);
        // Aynı gün ikinci okutma: mevcut girişi döndür (idempotent)
        WorkSession ws = todaysSession(app.getId(), today).orElse(null);
        boolean already = ws != null;
        if (ws == null) {
            if (!workSessionRepository.findByApplicationCandidateIdAndClockOutAtIsNull(candidateId).isEmpty()) {
                throw new BusinessRuleException("Başka bir işte açık mesain var — önce onu bitir");
            }
            ws = workSessionRepository.save(WorkSession.builder()
                    .application(app).clockInAt(LocalDateTime.now(clock)).build());
            log.info("[CHECKIN-QR] appId={} candId={}", app.getId(), candidateId);
        }
        JobListing l = app.getJobListing();
        return CheckInResult.builder()
                .applicationId(app.getId())
                .fullName(app.getCandidate().getFullName())
                .listingTitle(l.getTitle())
                .businessName(l.getBusiness().getName())
                .clockInAt(ws.getClockInAt())
                .alreadyCheckedIn(already)
                .shift(T.format(t.slot().getStartTime()) + " – " + T.format(t.slot().getEndTime()))
                .meetingPoint(l.getMeetingPoint())
                .build();
    }

    /** "  AYŞE   Demir " == "ayse demir" (Türkçe küçük harf, aksansız, tek boşluk). */
    static String normalize(String s) {
        if (s == null) return "";
        String lower = s.trim().replaceAll("\\s+", " ").toLowerCase(TR_LOCALE).replace('ı', 'i');
        return Normalizer.normalize(lower, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
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
        private String businessName;
        private LocalDate date;
        private String meetingPoint;
        private Integer meetingMinutesBefore;
        /** İşletmenin kalıcı giriş QR'ı (personel girişine asılır). */
        private String checkinUrl;
        private int expected;
        private int arrived;
        private List<RosterRow> rows;
    }

    @Data @Builder
    public static class CheckInResult {
        /** Aynı isimden birden fazla kişi var → telefon son 4 hane ile tekrar dene. */
        private boolean needPhone;
        private Long applicationId;
        private String fullName;
        private String listingTitle;
        private String businessName;
        private LocalDateTime clockInAt;
        private boolean alreadyCheckedIn;
        private String shift;
        private String meetingPoint;
    }
}
