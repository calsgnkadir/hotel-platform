package com.hotelapp.dto;

import com.hotelapp.enums.ApplicationStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ReviewRequest {

    @NotNull(message = "Karar zorunlu (kabul veya ret)")
    private ApplicationStatus decision;   // sadece ACCEPTED veya REJECTED

    /** İsteğe bağlı açıklama; applications.note VARCHAR(255). */
    @Size(max = 255, message = "Not en fazla 255 karakter olabilir")
    private String note;
}
