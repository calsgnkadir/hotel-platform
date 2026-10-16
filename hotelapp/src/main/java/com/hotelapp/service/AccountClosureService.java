package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.JobListing;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.enums.ListingStatus;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.repository.ApplicationRepository;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.ShiftSlotRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Hesap kapanınca (KVKK silme talebi) ya da aday askıya alınınca (otomatik/admin ban)
 * hesabın platformdaki açık taahhütlerini sonuçlandırır. Üç çağıran tek kural:
 * {@link GdprService#requestDeletion}, {@code NoShowEventListener} (otomatik ban),
 * {@link AdminService#ban}.
 *
 * <ul>
 *   <li><b>İşletme sahibi:</b> ACTIVE/PAUSED ilanlar ortak kapanış yolundan kapanır
 *       ({@link JobListingService#closeAsModeration}: açık başvurular EXPIRED, adaya
 *       bildirim, ekip listesi olayı).</li>
 *   <li><b>Aday:</b> açık başvurular (PENDING/REVIEWING/HELD/STANDBY) WITHDRAWN; aktif
 *       yedek teklifi varsa zincir sıradaki yedeğe geçer. ACCEPTED başvuruların
 *       <i>henüz başlamamış</i> (ve verilen sınırdan önce başlayan) vardiyaları boşalır:
 *       koltuk atomik iner, işletmeye bildirim gider, boşalan slotlar için yedek
 *       zinciri tetiklenir. Başlamış/bitmiş vardiyalar, giriş kayıtları ve kazanç
 *       korunur: başvurunun tüm vardiyaları boşalıyorsa başvuru WITHDRAWN olur (slot
 *       kaydı kalır, koltuk tutmaz); karışıksa başvuru ACCEPTED kalır ve yalnız boşalan
 *       vardiyalar başvurudan çıkar.</li>
 * </ul>
 * Geri alınmaz: ban bitince ya da hesap kurtarılınca boşalan vardiya geri gelmez.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountClosureService {

    /** Hesap kapanınca/askıda geri çekilen açık başvuru durumları (koltuk tutmazlar). */
    static final Set<ApplicationStatus> OPEN = EnumSet.of(
            ApplicationStatus.PENDING, ApplicationStatus.REVIEWING,
            ApplicationStatus.HELD, ApplicationStatus.STANDBY);

    public enum Reason { ACCOUNT_CLOSED, SUSPENDED }

    /** Sonuç özeti (audit + test + çağıranın bildirimi için). */
    public record Result(int withdrawnApplications, int vacatedShifts) {
        public static final Result NONE = new Result(0, 0);
    }

    private final ApplicationRepository applicationRepository;
    private final ShiftSlotRepository shiftSlotRepository;
    private final JobListingRepository jobListingRepository;
    private final JobListingService jobListingService;
    private final StandbyService standbyService;
    private final NotificationService notificationService;
    private final OutboxService outboxService;

    /** Atomik sayaç güncellemesinden sonra slot durumunu tazelemek için (yedek uygunluğu). */
    @PersistenceContext
    private EntityManager entityManager;

    /** Test edilebilir saat (ApplicationService ile aynı bölge). */
    Clock clock = Clock.system(ZoneId.of("Europe/Istanbul"));

    // ================================================================
    // İşletme sahibi
    // ================================================================

    /** İşletme sahibinin yayındaki/duraklatılmış ilanlarını kapatır. @return kapanan ilan sayısı */
    @Transactional
    public int closeBusinessListings(Long ownerId) {
        int closed = 0;
        for (JobListing listing : jobListingRepository.findAllByBusiness_OwnerId(ownerId)) {
            if (listing.getStatus() == ListingStatus.ACTIVE || listing.getStatus() == ListingStatus.PAUSED) {
                jobListingService.closeAsModeration(listing);
                closed++;
            }
        }
        if (closed > 0) {
            outboxService.appendAuditLog(AuditLoggedEvent.system(
                    "LISTINGS_CLOSED_ON_ACCOUNT_CLOSURE", "USER", ownerId,
                    "Hesap kapanışı: " + closed + " ilan kapatıldı."));
            log.info("[ACCOUNT-CLOSURE] owner={} icin {} ilan kapatildi", ownerId, closed);
        }
        return closed;
    }

    // ================================================================
    // Aday
    // ================================================================

    /**
     * Adayın açık başvurularını geri çeker ve gelecek vardiyalarını boşaltır.
     *
     * @param until  null: başlamamış tüm vardiyalar (hesap kapanışı). Dolu: yalnız bu
     *               andan ÖNCE başlayan vardiyalar (ban bitişi) — ban bittikten sonraki
     *               vardiyaya aday yeniden giriş yapıp gelebilir, o koltuk korunur.
     */
    @Transactional
    public Result releaseCandidate(Long candidateId, LocalDateTime until, Reason reason) {
        LocalDateTime now = LocalDateTime.now(clock);
        List<Application> apps = applicationRepository.findAllByCandidateId(candidateId);
        if (apps == null || apps.isEmpty()) return Result.NONE;

        int withdrawn = 0;
        int vacatedShifts = 0;
        List<Long> chainContinuations = new ArrayList<>();
        List<Vacated> vacatedApps = new ArrayList<>();

        for (Application app : apps) {
            ApplicationStatus status = app.getStatus();
            if (OPEN.contains(status)) {
                Long cascadeFor = StandbyService.activeOfferReplaces(app);
                app.setStatus(ApplicationStatus.WITHDRAWN);
                app.setHoldDeadline(null);
                app.setStandbyRank(null);
                app.setStandbyOfferedAt(null);
                app.setStandbyDeadline(null);
                app.setStandbyReplacesApplicationId(null);
                applicationRepository.save(app);
                withdrawn++;
                if (cascadeFor != null) chainContinuations.add(cascadeFor);
            } else if (status == ApplicationStatus.ACCEPTED && !NoShowSlots.isLegacy(app)) {
                // Eski (V25 öncesi) gelmedi kaydında koltuklar zaten boşaltılmıştı: dokunma.
                List<ShiftSlot> future = SlotSeats.byId(app.getRequestedSlots()).stream()
                        .filter(ShiftWindow::hasTimes)
                        .filter(sl -> ShiftWindow.startAt(sl).isAfter(now))
                        .filter(sl -> until == null || ShiftWindow.startAt(sl).isBefore(until))
                        .filter(sl -> !NoShowSlots.isMarked(app, sl))
                        .toList();
                if (future.isEmpty()) continue;

                for (ShiftSlot slot : future) {
                    SlotSeats.release(shiftSlotRepository, slot);
                }
                if (future.size() == app.getRequestedSlots().size()) {
                    // Hiç çalışılmış/başlamış vardiya yok: başvuru geri çekilir, slot kaydı kalır.
                    app.setStatus(ApplicationStatus.WITHDRAWN);
                } else {
                    // Geçmiş vardiyalar (kazanç, giriş kaydı) ACCEPTED başvuruda kalır.
                    app.getRequestedSlots().removeAll(future);
                }
                applicationRepository.save(app);
                vacatedShifts += future.size();
                vacatedApps.add(new Vacated(app, future));
            }
        }

        // Atomik UPDATE bağlamdaki slot nesnelerini tazelemez; yedek uygunluğu (isFull)
        // güncel sayaçla değerlendirilsin.
        if (!vacatedApps.isEmpty()) {
            entityManager.flush();
            for (Vacated v : vacatedApps) {
                for (ShiftSlot slot : v.slots()) entityManager.refresh(slot);
            }
        }

        for (Long replaces : chainContinuations) {
            standbyService.offerAfterNoShow(replaces);
        }
        for (Vacated v : vacatedApps) {
            notifyBusiness(v, reason);
            ListingStatus ls = v.app().getJobListing().getStatus();
            if (ls == ListingStatus.ACTIVE || ls == ListingStatus.PAUSED) {
                standbyService.offerAfterNoShow(v.app().getId(),
                        v.slots().stream().map(ShiftSlot::getId).toList());
            }
        }

        if (withdrawn > 0 || vacatedShifts > 0) {
            outboxService.appendAuditLog(AuditLoggedEvent.system(
                    reason == Reason.ACCOUNT_CLOSED ? "COMMITMENTS_RELEASED_ON_CLOSURE"
                                                    : "COMMITMENTS_RELEASED_ON_SUSPENSION",
                    "USER", candidateId,
                    "Geri çekilen açık başvuru: " + withdrawn + " · boşalan vardiya: " + vacatedShifts
                            + (until != null ? " · sınır: " + until : "")));
            log.info("[ACCOUNT-CLOSURE] candidate={} reason={} withdrawn={} vacatedShifts={}",
                    candidateId, reason, withdrawn, vacatedShifts);
        }
        return new Result(withdrawn, vacatedShifts);
    }

    private record Vacated(Application app, List<ShiftSlot> slots) {}

    private void notifyBusiness(Vacated v, Reason reason) {
        JobListing listing = v.app().getJobListing();
        if (listing.getBusiness() == null || listing.getBusiness().getOwner() == null) return;
        String shifts = v.slots().stream().map(SlotSeats::label).collect(Collectors.joining(", "));
        String candidateName = v.app().getCandidate() != null ? v.app().getCandidate().getFullName() : "Aday";
        String plural = v.slots().size() > 1 ? " vardiyaları boşaldı." : " vardiyası boşaldı.";
        String title = reason == Reason.ACCOUNT_CLOSED
                ? "Aday hesabını kapattı"
                : "Aday vardiyaya katılamayacak";
        String who = reason == Reason.ACCOUNT_CLOSED
                ? candidateName + " hesabını kapattı. "
                : candidateName + " adlı adayın hesabı geçici olarak kısıtlandı. ";
        String message = who + listing.getTitle() + " · " + shifts + plural;
        notificationService.notify(listing.getBusiness().getOwner().getId(),
                NotificationType.APPLICATION_WITHDRAWN, title, message, "applications");
    }
}
