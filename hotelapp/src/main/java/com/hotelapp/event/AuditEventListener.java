package com.hotelapp.event;

import com.hotelapp.service.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * FAZ 4.10 — AuditLoggedEvent async listener.
 * AFTER_COMMIT garantisi: ana transaction commit olduktan sonra calisir,
 * yani sadece basariyla biten action'lar log'a girer.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditEventListener {

    private final AuditLogService auditLogService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onAuditLogged(AuditLoggedEvent e) {
        try {
            if (e.isSystem()) {
                auditLogService.logSystem(e.action(), e.targetType(), e.targetId(), e.details());
            } else {
                auditLogService.log(e.actorId(), e.action(), e.targetType(), e.targetId(), e.details());
            }
        } catch (Exception ex) {
            log.warn("[AUDIT-ASYNC] audit log fail action={} - {}", e.action(), ex.getMessage());
        }
    }
}
