package com.hotelapp.dto;

import com.hotelapp.validation.PasswordMaxBytes;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {
    @Email
    @NotBlank
    private String email;

    @NotBlank
    @PasswordMaxBytes
    private String password;
}
