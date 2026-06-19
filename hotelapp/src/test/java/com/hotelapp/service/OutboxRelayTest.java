package com.hotelapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.entity.OutboxEvent;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.event.EmailMessage;
import com.hotelapp.repository.OutboxEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

@ExtendWith(MockitoExtension.class)
class OutboxRelayTest {

    @Mock private OutboxEventRepository outboxRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private EmailService emailService;       // FAZ D.9
    @Mock private OutboxStatusWriter statusWriter; // FAZ F.4
    private final ObjectMapper objectMapper = new ObjectMapper();

    private OutboxRelay relay;

    @BeforeEach
    void setUp() {
        org.springframework.beans.factory.ObjectProvider<com.hotelapp.metrics.AppMetrics> noMetrics =
                emptyProvider();
        relay = new OutboxRelay(outboxRepository, objectMapper, auditLogService, emailService,
                statusWriter, noMetrics);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static <T> org.springframework.beans.factory.ObjectProvider<T> emptyProvider() {
        org.springframework.beans.factory.ObjectProvider p =
                mock(org.springframework.beans.factory.ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(null);
        return (org.springframework.beans.factory.ObjectProvider<T>) p;
    }

    @Test
    @DisplayName("relay: AUDIT_LOG (user) -> auditLogService.log + statusWriter.markProcessed")
    void relay_userAuditLog_processed() throws Exception {
        var event = AuditLoggedEvent.user(42L, "BAN_USER", "USER", 99L, "detail");
        var row = OutboxEvent.builder()
                .id(1L)
                .eventType(OutboxService.TYPE_AUDIT_LOG)
                .payload(objectMapper.writeValueAsString(event))
                .createdAt(LocalDateTime.now())
                .attempts(0)
                .build();
        when(outboxRepository.findUnprocessed(eq(OutboxRelay.MAX_ATTEMPTS), any()))
                .thenReturn(List.of(row));

        relay.relay();

        verify(auditLogService).log(42L, "BAN_USER", "USER", 99L, "detail");
        verify(statusWriter).markProcessed(1L);
        verify(statusWriter, never()).markFailed(any(), any(), anyInt());
    }

    @Test
    @DisplayName("relay: AUDIT_LOG (system) -> auditLogService.logSystem")
    void relay_systemAuditLog_processed() throws Exception {
        var event = AuditLoggedEvent.system("AUTO_BAN", "USER", 7L, "auto");
        var row = OutboxEvent.builder()
                .id(2L)
                .eventType(OutboxService.TYPE_AUDIT_LOG)
                .payload(objectMapper.writeValueAsString(event))
                .createdAt(LocalDateTime.now())
                .attempts(0)
                .build();
        when(outboxRepository.findUnprocessed(eq(OutboxRelay.MAX_ATTEMPTS), any()))
                .thenReturn(List.of(row));

        relay.relay();

        verify(auditLogService).logSystem("AUTO_BAN", "USER", 7L, "auto");
        verify(auditLogService, never()).log(any(), anyString(), anyString(), any(), anyString());
        verify(statusWriter).markProcessed(2L);
    }

    @Test
    @DisplayName("relay: handler exception -> statusWriter.markFailed cagrilir")
    void relay_handlerFailure_marksFailed() throws Exception {
        var event = AuditLoggedEvent.user(1L, "ACT", "T", 1L, "d");
        var row = OutboxEvent.builder()
                .id(3L)
                .eventType(OutboxService.TYPE_AUDIT_LOG)
                .payload(objectMapper.writeValueAsString(event))
                .createdAt(LocalDateTime.now())
                .attempts(2)
                .build();
        when(outboxRepository.findUnprocessed(eq(OutboxRelay.MAX_ATTEMPTS), any()))
                .thenReturn(List.of(row));
        doThrow(new RuntimeException("DB down"))
                .when(auditLogService).log(any(), anyString(), anyString(), any(), anyString());

        relay.relay();

        ArgumentCaptor<Exception> exCap = ArgumentCaptor.forClass(Exception.class);
        verify(statusWriter).markFailed(eq(3L), exCap.capture(), eq(OutboxRelay.MAX_ATTEMPTS));
        assertThat(exCap.getValue().getMessage()).contains("DB down");
        verify(statusWriter, never()).markProcessed(any());
    }

    @Test
    @DisplayName("relay: bilinmeyen eventType -> handler fail, markFailed cagrilir")
    void relay_unknownType_marksFailed() {
        var row = OutboxEvent.builder()
                .id(4L)
                .eventType("WEIRD_TYPE")
                .payload("{}")
                .createdAt(LocalDateTime.now())
                .attempts(0)
                .build();
        when(outboxRepository.findUnprocessed(eq(OutboxRelay.MAX_ATTEMPTS), any()))
                .thenReturn(List.of(row));

        relay.relay();

        verify(statusWriter).markFailed(eq(4L), any(IllegalArgumentException.class),
                eq(OutboxRelay.MAX_ATTEMPTS));
    }

    @Test
    @DisplayName("relay: EMAIL -> emailService.send + processed")
    void relay_email_sent() throws Exception {
        EmailMessage msg = new EmailMessage("to@x.com", "Konu", "<p>body</p>");
        OutboxEvent row = OutboxEvent.builder()
                .id(10L)
                .eventType(OutboxService.TYPE_EMAIL)
                .payload(objectMapper.writeValueAsString(msg))
                .createdAt(LocalDateTime.now())
                .attempts(0)
                .build();
        when(outboxRepository.findUnprocessed(eq(OutboxRelay.MAX_ATTEMPTS), any()))
                .thenReturn(List.of(row));

        relay.relay();

        verify(emailService).send("to@x.com", "Konu", "<p>body</p>");
        verify(statusWriter).markProcessed(10L);
    }

    @Test
    @DisplayName("relay: EMAIL gonderim hatasi -> markFailed cagrilir")
    void relay_email_failure_retried() throws Exception {
        EmailMessage msg = new EmailMessage("to@x.com", "Konu", "<p>body</p>");
        OutboxEvent row = OutboxEvent.builder()
                .id(11L)
                .eventType(OutboxService.TYPE_EMAIL)
                .payload(objectMapper.writeValueAsString(msg))
                .createdAt(LocalDateTime.now())
                .attempts(0)
                .build();
        when(outboxRepository.findUnprocessed(eq(OutboxRelay.MAX_ATTEMPTS), any()))
                .thenReturn(List.of(row));
        doThrow(new RuntimeException("Resend 500"))
                .when(emailService).send(anyString(), anyString(), anyString());

        relay.relay();

        verify(statusWriter).markFailed(eq(11L), any(RuntimeException.class),
                eq(OutboxRelay.MAX_ATTEMPTS));
    }
}
