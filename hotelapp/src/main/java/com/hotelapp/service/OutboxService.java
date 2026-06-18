package com.hotelapp.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.entity.OutboxEvent;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * FAZ C.2 — Transactional Outbox publisher.
 *
 * Service'ler domain mutation ile ayni TX icinde appendAuditLog cagirir.
 * OutboxRelay async olarak row'lari okur ve handler'a yonlendirir.
 *
 * REQUIRED propagation: parent TX varsa katilir (atomik garanti),
 * yoksa kendi TX'ini acar.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OutboxService {

    public static final String TYPE_AUDIT_LOG = "AUDIT_LOG";

    private final OutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.REQUIRED)
    public void appendAuditLog(AuditLoggedEvent event) {
        String payload;
        try {
            payload = objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException e) {
            // Cok kucuk ihtimal — record icindeki primitives serialize edilemezse
            log.error("[OUTBOX] AuditLoggedEvent serialize edilemedi action={}", event.action(), e);
            return;
        }
        OutboxEvent row = OutboxEvent.builder()
                .eventType(TYPE_AUDIT_LOG)
                .payload(payload)
                .createdAt(LocalDateTime.now())
                .attempts(0)
                .build();
        outboxRepository.save(row);
    }
}
