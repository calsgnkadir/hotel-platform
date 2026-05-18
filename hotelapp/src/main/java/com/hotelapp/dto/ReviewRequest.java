package com.hotelapp.dto;

import com.hotelapp.enums.ApplicationStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ReviewRequest {

    @NotNull(message = "Karar zorunlu (ACCEPTED veya REJECTED)")
    private ApplicationStatus decision;   // sadece ACCEPTED veya REJECTED

    private String note;                  // opsiyonel açıklama
}
