package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.AdminService;
import com.hotelapp.service.AuditLogService;
import com.hotelapp.service.OutboxAdminService;
import com.hotelapp.service.OutboxService;
import com.hotelapp.service.ReportService;
import com.hotelapp.service.SupportTicketService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** KVKK: admin ban/ban kaldirma audit kaydinda hedef kullanicinin e-postasi yazilmaz. */
@ExtendWith(MockitoExtension.class)
class AdminControllerAuditTest {

    @Mock private AdminService adminService;
    @Mock private ReportService reportService;
    @Mock private AuditLogService auditLogService;
    @Mock private OutboxService outboxService;
    @Mock private OutboxAdminService outboxAdminService;
    @Mock private SupportTicketService supportService;
    @InjectMocks private AdminController controller;

    private final UserPrincipal admin = new UserPrincipal(User.builder().id(1L).email("admin@test.com").build());

    private AdminService.UserSummary target() {
        return AdminService.UserSummary.builder().id(9L).email("hedef@test.com").build();
    }

    private AuditLoggedEvent captured() {
        ArgumentCaptor<AuditLoggedEvent> cap = ArgumentCaptor.forClass(AuditLoggedEvent.class);
        verify(outboxService).appendAuditLog(cap.capture());
        return cap.getValue();
    }

    @Test
    @DisplayName("BAN_USER: details userId içerir, e-posta içermez")
    void ban_auditHasUserIdNotEmail() {
        when(adminService.ban(9L, 7)).thenReturn(target());
        AdminService.BanRequest req = new AdminService.BanRequest();
        req.setDays(7);

        controller.ban(admin, 9L, req);

        AuditLoggedEvent ev = captured();
        assertThat(ev.action()).isEqualTo("BAN_USER");
        assertThat(ev.actorId()).isEqualTo(1L);
        assertThat(ev.targetId()).isEqualTo(9L);
        assertThat(ev.details()).contains("userId=9").doesNotContain("@");
    }

    @Test
    @DisplayName("UNBAN_USER: details userId içerir, e-posta içermez")
    void unban_auditHasUserIdNotEmail() {
        when(adminService.unban(9L)).thenReturn(target());

        controller.unban(admin, 9L);

        AuditLoggedEvent ev = captured();
        assertThat(ev.action()).isEqualTo("UNBAN_USER");
        assertThat(ev.details()).contains("userId=9").doesNotContain("@");
    }
}
