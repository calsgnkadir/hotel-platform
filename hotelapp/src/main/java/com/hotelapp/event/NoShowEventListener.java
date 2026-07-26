package com.hotelapp.event;

import com.hotelapp.enums.NotificationType;
import com.hotelapp.service.NotificationService;
import com.hotelapp.service.OutboxService;
import com.hotelapp.service.StandbyService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * FAZ 4.11 — markNoShow side effect'leri (audit log + notification) async + AFTER_COMMIT.
 *
 * Why:
 *  - markNoShow endpoint'i ana DB mutation (strike + ban) sonrasi cevap dondurur.
 *  - Side effect'ler (audit log, notification, email) ayri thread'de calisir,
 *    ana request response'unu bekletmez.
 *  - AFTER_COMMIT: transaction commit olduktan sonra calisir → eksik strike write riski yok.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NoShowEventListener {

    private final NotificationService notificationService;
    private final OutboxService outboxService; // FAZ C.2 — audit log outbox uzerinden
    private final StandbyService standbyService; // FAZ C.1 — yedek adaya otomatik teklif

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onNoShowMarked(NoShowMarkedEvent e) {
        log.info("[NO-SHOW-ASYNC] handling event for application={} candidate={}",
                e.applicationId(), e.candidateEmail());

        // FAZ C.2 — Audit log Outbox'a yazilir, OutboxRelay async deliverıyor.
        outboxService.appendAuditLog(AuditLoggedEvent.user(
                e.actorOwnerId(), "MARK_NO_SHOW", "APPLICATION", e.applicationId(),
                "Aday " + e.candidateEmail() + " no-show isaretlendi. Kalan strike: "
                        + e.candidateStrikesRemaining()));

        if (e.autoBanned()) {
            outboxService.appendAuditLog(AuditLoggedEvent.system(
                    "AUTO_BAN", "USER", e.candidateId(),
                    "3 strike -> " + e.candidateEmail() + " otomatik 30 gun banlandi (bitis: "
                            + e.bannedUntil() + ")"));
        }

        try {
            // Aday bildirim
            notificationService.notify(e.candidateId(), NotificationType.NO_SHOW_MARKED,
                    "İşe gelmedin olarak işaretlendin",
                    e.listingTitle() + " için no-show işaretlendin. Kalan strike hakkın: "
                            + e.candidateStrikesRemaining(),
                    "applications");

            if (e.autoBanned()) {
                notificationService.notify(e.candidateId(), NotificationType.AUTO_BANNED,
                        "Hesabın geçici olarak askıya alındı",
                        "Çok sayıda no-show nedeniyle hesabın " + e.bannedUntil().toLocalDate()
                                + " tarihine kadar askıya alındı.",
                        null);
            }
        } catch (Exception ex) {
            log.warn("[NO-SHOW-ASYNC] notification fail: {}", ex.getMessage());
        }

        // FAZ C.1 — "Gelmezse yerine adam": siradaki yedege otomatik acil teklif.
        // Ana no-show islemi commit oldugu icin burada patlarsa strike/ban etkilenmez.
        try {
            Long offeredTo = standbyService.offerAfterNoShow(e.applicationId());
            if (offeredTo != null) {
                log.info("[NO-SHOW-ASYNC] yedek teklifi gonderildi: app={}", offeredTo);
            }
        } catch (Exception ex) {
            log.warn("[NO-SHOW-ASYNC] standby teklifi basarisiz: {}", ex.getMessage());
        }
    }
}
