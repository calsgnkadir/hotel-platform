package com.hotelapp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MessageRequest {

    @NotBlank(message = "Mesaj boş olamaz")
    @Size(max = 2000, message = "Mesaj en fazla 2000 karakter olabilir")
    private String content;
}
