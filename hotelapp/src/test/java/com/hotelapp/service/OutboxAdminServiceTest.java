package com.hotelapp.service;

import com.hotelapp.entity.OutboxEvent;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.OutboxEventRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OutboxAdminServiceTest {

    @Mock private OutboxEventRepository outboxRepository;
    @InjectMocks private OutboxAdminService service;

    private OutboxEvent ev(long id, Integer attempts, LocalDateTime processed) {
        return OutboxEvent.builder()
                .id(id)
                .eventType("AUDIT_LOG")
                .payload("{\"x\":1}")
                .createdAt(LocalDateTime.now())
                .processedAt(processed)
                .attempts(attempts)
                .build();
    }

    @Test
    @DisplayName("list(all): tum event'leri sirayla doner, status hesaplanir")
    void list_all_returnsAllWithStatus() {
        Page<OutboxEvent> page = new PageImpl<>(List.of(
                ev(1L, 0, LocalDateTime.now()),   // DELIVERED
                ev(2L, 2, null),                   // PENDING
                ev(3L, 5, null)                    // DEAD
        ));
        when(outboxRepository.findAllByOrderByCreatedAtDesc(any(Pageable.class))).thenReturn(page);

        var list = service.list("all", 50);

        assertThat(list).hasSize(3);
        assertThat(list.get(0).getStatus()).isEqualTo("DELIVERED");
        assertThat(list.get(1).getStatus()).isEqualTo("PENDING");
        assertThat(list.get(2).getStatus()).isEqualTo("DEAD");
    }

    @Test
    @DisplayName("list(dead): sadece findDeadLetters çağrılır")
    void list_dead_callsDeadLettersQuery() {
        when(outboxRepository.findDeadLetters(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.list("dead", 50);

        verify(outboxRepository).findDeadLetters(any(Pageable.class));
    }

    @Test
    @DisplayName("list(pending): sadece findAllByProcessedAtIsNull çağrılır")
    void list_pending_callsPendingQuery() {
        when(outboxRepository.findAllByProcessedAtIsNullOrderByCreatedAtDesc(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.list("pending", 50);

        verify(outboxRepository).findAllByProcessedAtIsNullOrderByCreatedAtDesc(any(Pageable.class));
    }

    @Test
    @DisplayName("retry: attempts=0, lastError=null, processedAt=null")
    void retry_resetsFields() {
        OutboxEvent e = ev(7L, 5, null);
        e.setLastError("boom");
        when(outboxRepository.findById(7L)).thenReturn(Optional.of(e));

        service.retry(7L);

        ArgumentCaptor<OutboxEvent> cap = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepository).save(cap.capture());
        assertThat(cap.getValue().getAttempts()).isZero();
        assertThat(cap.getValue().getLastError()).isNull();
        assertThat(cap.getValue().getProcessedAt()).isNull();
    }

    @Test
    @DisplayName("retry: yoksa ResourceNotFoundException")
    void retry_notFound() {
        when(outboxRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.retry(999L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("payloadPreview: 200 karakterden uzun ise kesilir")
    void preview_truncates() {
        String big = "x".repeat(300);
        OutboxEvent e = ev(1L, 0, null);
        e.setPayload(big);
        Page<OutboxEvent> page = new PageImpl<>(List.of(e));
        when(outboxRepository.findAllByOrderByCreatedAtDesc(any(Pageable.class))).thenReturn(page);

        var dto = service.list("all", 50).get(0);

        assertThat(dto.getPayloadPreview()).hasSize(201).endsWith("…");
    }
}
