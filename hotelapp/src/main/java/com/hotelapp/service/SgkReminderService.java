package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * FAZ C.3 — SGK "işe giriş bildirgesi" hatırlatıcısı.
 *
 * <p>Türk mevzuatında işveren, sigortalıyı çalışmaya başlatmadan ÖNCE SGK'ya
 * işe giriş bildirgesi vermek zorundadır. AjansHotel bir eşleştirme platformu
 * olduğu için bu yükümlülük İŞLETMEYE aittir — platform onu yerine getirmez,
 * ama vardiya yaklaşınca hatırlatarak hem işvereni ihlalden korur hem de
 * kendi hukuki duruşunu ("aracı platform, işveren değil") güçlendirir.
 *
 * <p>Bu, ÖİB (Özel İstihdam Bürosu) izni tartışmasında platformun konumunu
 * netleştiren şeffaflık adımlarından biri; kesin metin/yaklaşım hukuk görüşüne
 * tabidir (FAZ 0).
 *
 * <p>Idempotency: her başvuru için tek hatırlatma — {@code sgkReminderSentAt}
 * set edilir, tekrar gönderilmez.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SgkReminderService {

    private final ApplicationRepository applicationRepository;
    private final NotificationService notificationService;
    private final OutboxService outboxService;

    /**
     * Vardiyası bugün veya yarın olan, henüz hatırlatılmamış kabul edilmiş
     * başvurular için işletmeye SGK hatırlatması gönderir.
     *
     * @return gönderilen hatırlatma sayısı
     */
    @Transactional
    public int sendDueReminders() {
        LocalDate today = LocalDate.now();
        LocalDate tomorrow = today.plusDays(1);

        List<Application> due = applicationRepository
                .findAcceptedNeedingSgkReminder(today, tomorrow);
        if (due.isEmpty()) return 0;

        int sent = 0;
        for (Application app : due) {
            try {
                notifyOwner(app);
                app.setSgkReminderSentAt(LocalDateTime.now());
                applicationRepository.save(app);
                sent++;
            } catch (Exception ex) {
                log.warn("[SGK] hatirlatma basarisiz app={}: {}", app.getId(), ex.getMessage());
            }
        }
        log.info("[SGK] {} isletmeye ise giris bildirgesi hatirlatmasi gonderildi", sent);
        return sent;
    }

    private void notifyOwner(Application app) {
        Long ownerId = app.getJobListing().getBusiness().getOwner().getId();
        String candidateName = app.getCandidate().getFullName();
        String listingTitle = app.getJobListing().getTitle();
        String when = nearestSlotLabel(app);

        notificationService.notify(ownerId, NotificationType.SGK_REMINDER,
                "SGK işe giriş bildirgesi hatırlatması",
                candidateName + " · " + listingTitle
                        + (when != null ? " · " + when : "")
                        + " — çalışma başlamadan önce işe giriş bildirgesini (SGK) vermeyi unutmayın. "
                        + "Bu yasal yükümlülük işletmeye aittir.",
                "applications");

        outboxService.appendAuditLog(AuditLoggedEvent.system(
                "SGK_REMINDER_SENT", "APPLICATION", app.getId(),
                "İşletme owner=" + ownerId + " için SGK işe giriş bildirgesi hatırlatması gönderildi."));
    }

    /** En yakın vardiyanın "bugün 16:00" / "yarın 08:00" etiketi. */
    private String nearestSlotLabel(Application app) {
        if (app.getRequestedSlots() == null) return null;
        LocalDate today = LocalDate.now();
        return app.getRequestedSlots().stream()
                .filter(s -> s.getDate() != null && !s.getDate().isBefore(today))
                .min((a, b) -> {
                    int c = a.getDate().compareTo(b.getDate());
                    return c != 0 ? c : a.getStartTime().compareTo(b.getStartTime());
                })
                .map(this::slotLabel)
                .orElse(null);
    }

    private String slotLabel(ShiftSlot s) {
        LocalDate today = LocalDate.now();
        String day = s.getDate().isEqual(today) ? "bugün"
                : s.getDate().isEqual(today.plusDays(1)) ? "yarın"
                : s.getDate().getDayOfMonth() + "." + s.getDate().getMonthValue();
        return s.getStartTime() != null
                ? day + " " + s.getStartTime().toString().substring(0, 5)
                : day;
    }
}
