package com.hotelapp.dto;

import com.hotelapp.enums.DocumentType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

@Data
public class ApplicationRequest {

    @NotNull(message = "İlan ID zorunlu")
    private Long jobListingId;

    private String coverLetter; // optional

    /** Eski akış (Faz E öncesi) — yeni başvurular boş bırakmalı */
    private List<AvailabilityDto> availabilities; // optional/legacy

    /**
     * Faz E1: Adayın başvurduğu spesifik vardiya slotları.
     * Yeni akışta en az 1 zorunlu.
     */
    private List<Long> slotIds; // optional in DTO, validated in service

    /**
     * Aday başvururken hassas belge tiplerini önceden işletmeye açık yapabilir.
     * Bu tipler için otomatik GRANTED durumda DocumentRequest oluşturulur,
     * işletmenin ayrıca talep etmesine gerek kalmaz.
     * Açık belgeler (CV, TRANSCRIPT, STUDENT_CERTIFICATE) zaten herkese açık.
     */
    private Set<DocumentType> grantedSensitiveTypes; // optional

    @Data
    public static class AvailabilityDto {
        private DayOfWeek dayOfWeek;
        private LocalTime startTime;
        private LocalTime endTime;
    }
}
