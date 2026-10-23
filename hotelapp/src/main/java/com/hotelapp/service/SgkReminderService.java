package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.entity.ShiftSlot;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * FAZ C.3 — SGK "işe giriş bildirgesi" hatırlatıcısı.
 *
 * <p>Türk mevzuatında işveren, sigortalıyı çalışmaya başlatmadan ÖNCE SGK'ya
 * işe giriş bildirgesi vermek zorundadır. Kadrom bir eşleştirme platformu
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

    /** İş kuralı saati: Türkiye yerel saati, JVM saat diliminden bağımsız (testte sabitlenebilir). */
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

    private final ApplicationRepository applicationRepository;
    private final NotificationService notificationService;
    private final OutboxService outboxService;

    /**
     * Kayıt başına transaction (REQUIRES_NEW): bir başvurudaki hata ya da @Version
     * çakışması (aynı anda gelmedi işareti / iptal) yalnız o kaydı geri alır; diğer
     * işletmelerin hatırlatmaları gider. Bildirim commit sonrası kuyruğa alındığından
     * gönderim ile {@code sgkReminderSentAt} aynı kayıt transaction'ında kalır: kayıt
     * geri alınırsa bildirim de gitmez, ertesi çalışmada yeniden denenir. Spring
     * bağlamında kurulur; bağlam dışı birim testlerinde transaction'sız çalışır
     * (ExpiredApplicationScheduler deseni).
     */
    private org.springframework.transaction.support.TransactionOperations perRecordTx =
            org.springframework.transaction.support.TransactionOperations.withoutTransaction();

    @org.springframework.beans.factory.annotation.Autowired
    void setTransactionManager(org.springframework.transaction.PlatformTransactionManager txManager) {
        org.springframework.transaction.support.TransactionTemplate t =
                new org.springframework.transaction.support.TransactionTemplate(txManager);
        t.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.perRecordTx = t;
    }

    /**
     * Vardiyası bugün veya yarın olan, henüz hatırlatılmamış kabul edilmiş
     * başvurular için işletmeye SGK hatırlatması gönderir. Bilerek
     * {@code @Transactional} değil: her kayıt kendi transaction'ında taze okunur.
     *
     * @return gönderilen hatırlatma sayısı
     */
    public int sendDueReminders() {
        LocalDate today = LocalDate.now(clock);
        LocalDate tomorrow = today.plusDays(1);

        List<Long> ids = applicationRepository
                .findAcceptedNeedingSgkReminder(today, tomorrow).stream()
                .map(Application::getId).toList();
        if (ids.isEmpty()) return 0;

        int sent = 0, failed = 0;
        for (Long id : ids) {
            try {
                Boolean done = perRecordTx.execute(st -> {
                    Application app = applicationRepository.findById(id).orElse(null);
                    // Arada iptal/gelmedi/başka çalışma hatırlattıysa dokunulmaz
                    if (app == null || !stillDue(app, today, tomorrow)) return false;
                    notifyOwner(app);
                    app.setSgkReminderSentAt(LocalDateTime.now(clock));
                    applicationRepository.saveAndFlush(app);
                    return true;
                });
                if (Boolean.TRUE.equals(done)) sent++;
            } catch (RuntimeException ex) {
                failed++;
                log.warn("[SGK] hatirlatma basarisiz app={} (sonraki calismada tekrar denenecek): {}",
                        id, ex.toString());
            }
        }
        if (failed > 0) log.warn("[SGK] {} / {} hatirlatma gonderilemedi", failed, ids.size());
        log.info("[SGK] {} isletmeye ise giris bildirgesi hatirlatmasi gonderildi", sent);
        return sent;
    }

    /** Sorgu koşulu taze kayıtta hâlâ geçerli mi (ACCEPTED, gelmedi yok, hatırlatılmamış, vardiya bugün/yarın). */
    static boolean stillDue(Application app, LocalDate from, LocalDate to) {
        if (app.getStatus() != com.hotelapp.enums.ApplicationStatus.ACCEPTED
                || app.isNoShow() || app.getSgkReminderSentAt() != null) return false;
        return app.getRequestedSlots() != null && app.getRequestedSlots().stream()
                .anyMatch(s -> s.getDate() != null && !s.getDate().isBefore(from) && !s.getDate().isAfter(to));
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
        LocalDate today = LocalDate.now(clock);
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
        LocalDate today = LocalDate.now(clock);
        String day = s.getDate().isEqual(today) ? "bugün"
                : s.getDate().isEqual(today.plusDays(1)) ? "yarın"
                : s.getDate().getDayOfMonth() + "." + s.getDate().getMonthValue();
        return s.getStartTime() != null
                ? day + " " + s.getStartTime().toString().substring(0, 5)
                : day;
    }
}
