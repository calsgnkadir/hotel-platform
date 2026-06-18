package com.hotelapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.entity.OutboxEvent;
import com.hotelapp.event.AuditLoggedEvent;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
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
    private final ObjectMapper objectMapper = new ObjectMapper();

    private OutboxRelay relay;

    @BeforeEach
    void setUp() {
        // FAZ D.4 — AppMetrics opsiyonel; test'te bos provider yeterli
        org.springframework.beans.factory.ObjectProvider<com.hotelapp.metrics.AppMetrics> noMetrics =
                emptyProvider();
        relay = new OutboxRelay(outboxRepository, objectMapper, auditLogService, noMetrics);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static <T> org.springframework.beans.factory.ObjectProvider<T> emptyProvider() {
        org.springframework.beans.factory.ObjectProvider p =
                mock(org.springframework.beans.factory.ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(null);
        return (org.springframework.beans.factory.ObjectProvider<T>) p;
    }

    @Test
    @DisplayName("relay: AUDIT_LOG (user) -> auditLogService.log + processed isaretler")
    void relay_userAuditLog_processed() throws Exception {
        var event = AuditLoggedEvent.user(42L, "BAN_USER", "USER", 99L, "detail");
        var row = OutboxEvent.builder()
                .id(1L)
                .eventType(OutboxService.TYPE_AUDIT_LOG)
                .payload(objectMapper.writeValueAsString(event))
                .createdAt(LocalDateTime.now())
                .attempts(0)
                .build();
        when(outboxRepository.findUnprocessed(any())).thenReturn(List.of(row));
        when(outboxRepository.findById(1L)).thenReturn(Optional.of(row));

        relay.relay();

        verify(auditLogService).log(42L, "BAN_USER", "USER", 99L, "detail");
        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(captor.capture());
        assertThat(captor.getValue().getProcessedAt()).isNotNull();
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
        when(outboxRepository.findUnprocessed(any())).thenReturn(List.of(row));
        when(outboxRepository.findById(2L)).thenReturn(Optional.of(row));

        relay.relay();

        verify(auditLogService).logSystem("AUTO_BAN", "USER", 7L, "auto");
        verify(auditLogService, never()).log(any(), anyString(), anyString(), any(), anyString());
    }

    @Test
    @DisplayName("relay: handler exception -> attempts++ + lastError, processedAt NULL kalir")
    void relay_handlerFailure_marksAttemptsAndError() throws Exception {
        var event = AuditLoggedEvent.user(1L, "ACT", "T", 1L, "d");
        var row = OutboxEvent.builder()
                .id(3L)
                .eventType(OutboxService.TYPE_AUDIT_LOG)
                .payload(objectMapper.writeValueAsString(event))
                .createdAt(LocalDateTime.now())
                .attempts(2)
                .build();
        when(outboxRepository.findUnprocessed(any())).thenReturn(List.of(row));
        when(outboxRepository.findById(3L)).thenReturn(Optional.of(row));
        doThrow(new RuntimeException("DB down"))
                .when(auditLogService).log(any(), anyString(), anyString(), any(), anyString());

        relay.relay();

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(captor.capture());
        OutboxEvent saved = captor.getValue();
        assertThat(saved.getAttempts()).isEqualTo(3);
        assertThat(saved.getLastError()).contains("DB down");
        assertThat(saved.getProcessedAt()).isNull();
    }

    @Test
    @DisplayName("relay: bilinmeyen eventType -> hata fail markaslar")
    void relay_unknownType_marksFailed() {
        var row = OutboxEvent.builder()
                .id(4L)
                .eventType("WEIRD_TYPE")
                .payload("{}")
                .createdAt(LocalDateTime.now())
                .attempts(0)
                .build();
        when(outboxRepository.findUnprocessed(any())).thenReturn(List.of(row));
        when(outboxRepository.findById(4L)).thenReturn(Optional.of(row));

        relay.relay();

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(captor.capture());
        assertThat(captor.getValue().getAttempts()).isEqualTo(1);
        assertThat(captor.getValue().getLastError()).contains("unknown event type");
    }
}
