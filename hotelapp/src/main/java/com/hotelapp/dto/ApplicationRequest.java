package com.hotelapp.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

@Data
public class ApplicationRequest {

    @NotNull(message = "İlan ID zorunlu")
    private Long jobListingId;

    /** İsteğe bağlı; ilk sohbet mesajı olur, bu yüzden mesaj sınırıyla (2000) aynı. */
    @Size(max = 2000, message = "Ön yazı en fazla 2000 karakter olabilir")
    private String coverLetter;

    /** Eski akış (Faz E öncesi) — yeni başvurular boş bırakmalı */
    private List<AvailabilityDto> availabilities; // optional/legacy

    /**
     * Faz E1: Adayın başvurduğu spesifik vardiya slotları.
     * Yeni akışta en az 1 zorunlu.
     */
    private List<Long> slotIds; // optional in DTO, validated in service

    @Data
    public static class AvailabilityDto {
        private DayOfWeek dayOfWeek;
        private LocalTime startTime;
        private LocalTime endTime;
    }
}
