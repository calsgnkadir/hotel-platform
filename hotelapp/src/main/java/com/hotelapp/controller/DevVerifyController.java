package com.hotelapp.controller;

import com.hotelapp.entity.EmailVerificationToken;
import com.hotelapp.entity.User;
import com.hotelapp.repository.EmailVerificationTokenRepository;
import com.hotelapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * SADECE DEV profile — verification flow'unu local'de test etmek icin.
 * Bir email'in son aktif verification link'ini doner.
 * Production'da @Profile("dev") sayesinde devre disi.
 */
@RestController
@RequestMapping("/api/dev")
@RequiredArgsConstructor
@Profile("dev")
public class DevVerifyController {

    private final UserRepository userRepository;
    private final EmailVerificationTokenRepository tokenRepository;

    @Value("${app.base-url:http://localhost:5173}")
    private String baseUrl;

    @GetMapping("/last-verification-link")
    public ResponseEntity<?> lastVerificationLink(@RequestParam String email) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) return ResponseEntity.ok(Map.of("error", "user not found"));

        List<EmailVerificationToken> all = tokenRepository.findAll();
        EmailVerificationToken latest = all.stream()
                .filter(t -> t.getUser().getId().equals(user.getId()))
                .filter(t -> t.getUsedAt() == null)
                .max(Comparator.comparing(EmailVerificationToken::getCreatedAt))
                .orElse(null);

        if (latest == null) return ResponseEntity.ok(Map.of("error", "no active token"));

        String link = baseUrl + "/verify-email?token=" + latest.getToken();
        return ResponseEntity.ok(Map.of(
                "email", email,
                "userId", user.getId(),
                "emailVerified", user.isEmailVerified(),
                "link", link,
                "token", latest.getToken(),
                "expiresAt", latest.getExpiresAt().toString()
        ));
    }
}
