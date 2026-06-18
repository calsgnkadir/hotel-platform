package com.hotelapp.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.entity.OutboxEvent;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.repository.OutboxEventRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class OutboxServiceTest {

    @Mock private OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private OutboxService service;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new OutboxService(outboxRepository, objectMapper);
    }

    @Test
    @DisplayName("appendAuditLog: USER event'i type + JSON payload ile yazar")
    void appendAuditLog_userEvent() {
        AuditLoggedEvent event = AuditLoggedEvent.user(
                42L, "BAN_USER", "USER", 99L, "test detail");

        service.appendAuditLog(event);

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(captor.capture());
        OutboxEvent saved = captor.getValue();

        assertThat(saved.getEventType()).isEqualTo(OutboxService.TYPE_AUDIT_LOG);
        assertThat(saved.getProcessedAt()).isNull();
        assertThat(saved.getAttempts()).isZero();
        assertThat(saved.getCreatedAt()).isNotNull();
        // Payload icinde event field'lari olmali
        assertThat(saved.getPayload()).contains("\"action\":\"BAN_USER\"");
        assertThat(saved.getPayload()).contains("\"actorId\":42");
        assertThat(saved.getPayload()).contains("\"isSystem\":false");
    }

    @Test
    @DisplayName("appendAuditLog: SYSTEM event'i isSystem=true payload yazar")
    void appendAuditLog_systemEvent() {
        AuditLoggedEvent event = AuditLoggedEvent.system(
                "AUTO_BAN", "USER", 7L, "auto ban detail");

        service.appendAuditLog(event);

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(captor.capture());
        OutboxEvent saved = captor.getValue();

        assertThat(saved.getPayload()).contains("\"isSystem\":true");
        assertThat(saved.getPayload()).contains("\"actorId\":null");
        assertThat(saved.getPayload()).contains("\"action\":\"AUTO_BAN\"");
    }
}
