package com.hotelapp.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;

@Data
public class ApplicationRequest {

    @NotNull(message = "İlan ID zorunlu")
    private Long jobListingId;

    private String coverLetter; // optional

    private List<AvailabilityDto> availabilities; // optional

    @Data
    public static class AvailabilityDto {
        private DayOfWeek dayOfWeek;
        private LocalTime startTime;
        private LocalTime endTime;
    }
}
