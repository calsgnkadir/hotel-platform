package com.hotelapp.dto;

import com.hotelapp.enums.DocumentType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class DocRequestCreate {

    @NotNull(message = "Belge tipi zorunlu")
    private DocumentType documentType;    // örn: CRIMINAL_RECORD
}
