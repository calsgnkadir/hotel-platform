package com.hotelapp.service;

import com.hotelapp.entity.Report;
import com.hotelapp.entity.User;
import com.hotelapp.enums.ReportReason;
import com.hotelapp.enums.ReportStatus;
import com.hotelapp.enums.ReportType;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.repository.ReportRepository;
import com.hotelapp.repository.UserRepository;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;

    // ----------------------------------------------------------------
    // Kullanıcı: şikayet oluştur
    // ----------------------------------------------------------------
    @Transactional
    public ReportDto createReport(Long reporterId, CreateReportRequest req) {
        User reporter = userRepository.findById(reporterId)
                .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı", reporterId));

        if (req.getReason() == ReportReason.OTHER
                && (req.getDescription() == null || req.getDescription().isBlank())) {
            throw new BusinessRuleException("'Diğer' seçildiğinde açıklama zorunludur");
        }

        Report report = Report.builder()
                .reporter(reporter)
                .targetType(req.getTargetType())
                .targetId(req.getTargetId())
                .reason(req.getReason())
                .description(req.getDescription())
                .status(ReportStatus.PENDING)
                .build();

        reportRepository.save(report);
        return toDto(report);
    }

    // ----------------------------------------------------------------
    // Admin: tüm şikayetleri listele (opsiyonel status filtresi)
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<ReportDto> listReports(ReportStatus status) {
        List<Report> reports = (status != null)
                ? reportRepository.findAllByStatusOrderByCreatedAtDesc(status)
                : reportRepository.findAllByOrderByCreatedAtDesc();
        return reports.stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public long countPending() {
        return reportRepository.countByStatus(ReportStatus.PENDING);
    }

    // ----------------------------------------------------------------
    // Admin: şikayet durumunu güncelle (RESOLVED / DISMISSED)
    // ----------------------------------------------------------------
    @Transactional
    public ReportDto updateStatus(Long reportId, ReportStatus newStatus, String adminNote) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Şikayet", reportId));
        report.setStatus(newStatus);
        report.setAdminNote(adminNote);
        report.setReviewedAt(LocalDateTime.now());
        reportRepository.save(report);
        return toDto(report);
    }

    // ----------------------------------------------------------------
    // Mapping
    // ----------------------------------------------------------------
    private ReportDto toDto(Report r) {
        return ReportDto.builder()
                .id(r.getId())
                .reporterId(r.getReporter().getId())
                .reporterName(r.getReporter().getFullName())
                .reporterEmail(r.getReporter().getEmail())
                .targetType(r.getTargetType())
                .targetId(r.getTargetId())
                .reason(r.getReason())
                .description(r.getDescription())
                .status(r.getStatus())
                .adminNote(r.getAdminNote())
                .createdAt(r.getCreatedAt())
                .reviewedAt(r.getReviewedAt())
                .build();
    }

    // ----------------------------------------------------------------
    // DTOs
    // ----------------------------------------------------------------
    @Data @Builder
    public static class ReportDto {
        private Long id;
        private Long reporterId;
        private String reporterName;
        private String reporterEmail;
        private ReportType targetType;
        private Long targetId;
        private ReportReason reason;
        private String description;
        private ReportStatus status;
        private String adminNote;
        private LocalDateTime createdAt;
        private LocalDateTime reviewedAt;
    }

    @Data
    public static class CreateReportRequest {
        @NotNull(message = "Şikayet tipi zorunlu")
        private ReportType targetType;
        @NotNull(message = "Hedef ID zorunlu")
        private Long targetId;
        @NotNull(message = "Şikayet nedeni zorunlu")
        private ReportReason reason;
        private String description;
    }

    @Data
    public static class UpdateReportStatusRequest {
        @NotNull(message = "Durum zorunlu")
        private ReportStatus status;
        private String adminNote;
    }
}
