package com.hotelapp.service;

import com.hotelapp.entity.SupportTicket;
import com.hotelapp.entity.User;
import com.hotelapp.enums.SupportStatus;
import com.hotelapp.enums.SupportSubject;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.SupportTicketRepository;
import com.hotelapp.repository.UserRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * FAZ I.5 — Destek bileti servisi.
 * - Kullanıcı: kendi biletini açar, kendi biletlerini görür.
 * - Admin:    tümünü filtreyle listeler, status + admin notu günceller.
 *
 * Audit izi outbox üzerinden (SUPPORT_OPEN / SUPPORT_RESOLVED).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SupportTicketService {

    private static final int DAILY_LIMIT_PER_USER = 5;   // spam koruması
    private static final int MAX_ADMIN_PAGE       = 100;

    private final SupportTicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final OutboxService outboxService;

    /** Kullanıcı yeni bilet açar. Günlük 5 ile sınırlı (anti-spam). */
    @Transactional
    public TicketDto submit(Long userId, CreateRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", userId));

        // Anti-spam: son 24 saatte aynı kullanıcıdan kaç bilet?
        var since = LocalDateTime.now().minusHours(24);
        long todayCount = ticketRepository.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(t -> t.getCreatedAt() != null && t.getCreatedAt().isAfter(since))
                .count();
        if (todayCount >= DAILY_LIMIT_PER_USER) {
            throw new BusinessRuleException(
                    "Günde en fazla " + DAILY_LIMIT_PER_USER + " destek talebi açabilirsiniz.");
        }

        SupportTicket t = SupportTicket.builder()
                .user(user)
                .subject(req.getSubject())
                .message(req.getMessage().trim())
                .status(SupportStatus.OPEN)
                .build();
        ticketRepository.save(t);

        outboxService.appendAuditLog(AuditLoggedEvent.user(
                userId, "SUPPORT_OPEN", "SUPPORT_TICKET", t.getId(),
                "Yeni destek talebi: " + req.getSubject()));

        return toDto(t);
    }

    /** Kullanıcı kendi biletlerini görür (kronolojik, en yeni önce). */
    @Transactional(readOnly = true)
    public List<TicketDto> listMine(Long userId) {
        return ticketRepository.findAllByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toDto)
                .toList();
    }

    /** Admin liste — status filtreli (null = tümü). */
    @Transactional(readOnly = true)
    public List<TicketDto> listForAdmin(SupportStatus status, int limit) {
        int safe = Math.min(Math.max(limit, 1), MAX_ADMIN_PAGE);
        Page<SupportTicket> page = ticketRepository.searchForAdmin(status, PageRequest.of(0, safe));
        return page.getContent().stream().map(this::toDto).toList();
    }

    /** Admin: status + opsiyonel admin notu güncelle. */
    @Transactional
    public TicketDto updateStatus(Long ticketId, Long adminId, SupportStatus newStatus, String adminNote) {
        SupportTicket t = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Destek bileti", ticketId));

        t.setStatus(newStatus);
        if (adminNote != null && !adminNote.isBlank()) {
            t.setAdminNote(adminNote.trim());
        }
        if (newStatus == SupportStatus.RESOLVED || newStatus == SupportStatus.DISMISSED) {
            t.setResolvedAt(LocalDateTime.now());
        }
        ticketRepository.save(t);

        outboxService.appendAuditLog(AuditLoggedEvent.user(
                adminId, "SUPPORT_" + newStatus.name(), "SUPPORT_TICKET", ticketId,
                "Bilet #" + ticketId + " → " + newStatus));

        return toDto(t);
    }

    // ────────────────────────────────────────
    private TicketDto toDto(SupportTicket t) {
        return TicketDto.builder()
                .id(t.getId())
                .userId(t.getUser() != null ? t.getUser().getId() : null)
                .userEmail(t.getUser() != null ? t.getUser().getEmail() : null)
                .userFullName(t.getUser() != null ? t.getUser().getFullName() : null)
                .userRole(t.getUser() != null && t.getUser().getRole() != null
                        ? t.getUser().getRole().name() : null)
                .subject(t.getSubject() != null ? t.getSubject().name() : null)
                .message(t.getMessage())
                .status(t.getStatus() != null ? t.getStatus().name() : null)
                .adminNote(t.getAdminNote())
                .createdAt(t.getCreatedAt())
                .resolvedAt(t.getResolvedAt())
                .build();
    }

    @Data @Builder
    public static class TicketDto {
        private Long id;
        private Long userId;
        private String userEmail;
        private String userFullName;
        private String userRole;
        private String subject;
        private String message;
        private String status;
        private String adminNote;
        private LocalDateTime createdAt;
        private LocalDateTime resolvedAt;
    }

    @Data
    public static class CreateRequest {
        @NotNull
        private SupportSubject subject;
        @NotBlank
        @Size(min = 10, max = 2000, message = "Mesaj 10–2000 karakter arası olmalı")
        private String message;
    }

    @Data
    public static class UpdateStatusRequest {
        @NotNull
        private SupportStatus status;
        @Size(max = 2000)
        private String adminNote;
    }
}
