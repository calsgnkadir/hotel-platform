package com.hotelapp.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotelapp.security.UserPrincipal;
import com.hotelapp.service.GdprService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * FAZ D.8 — KVKK / GDPR endpoint'leri.
 * Kullanici kendi verisini indirir ve hesabini silme istegi gonderir.
 */
@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
@SecurityRequirement(name = "bearerAuth")
@Tag(name = "G. KVKK", description = "Kullanıcının kendi verisi (export + silme talebi)")
public class GdprController {

    private final GdprService gdprService;
    private final ObjectMapper objectMapper;

    @Operation(
            summary = "Verimi indir (KVKK)",
            description = "Profil + başvurular + bildirimler — JSON download."
    )
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportData(
            @AuthenticationPrincipal UserPrincipal currentUser) throws Exception {
        Map<String, Object> data = gdprService.exportUserData(currentUser.getId());
        byte[] json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(data);

        String filename = "ajanshotel-verim-"
                + currentUser.getId() + "-"
                + java.time.LocalDate.now().format(DateTimeFormatter.ISO_DATE)
                + ".json";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setContentLength(json.length);
        // FAZ F.2 — PII icerigi shared proxy / browser cache'inde tutulmasin (KVKK m.12)
        headers.setCacheControl(CacheControl.noStore());
        headers.setPragma("no-cache");

        return new ResponseEntity<>(json, headers, 200);
    }

    @Operation(
            summary = "Hesabımı sil (KVKK)",
            description = "Soft delete + 30 gün anonymize bekleme süresi. " +
                    "Bu süre içinde destek hattından recovery isteyebilirsiniz."
    )
    @DeleteMapping
    public ResponseEntity<Map<String, Object>> deleteAccount(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        gdprService.requestDeletion(currentUser.getId());
        return ResponseEntity.ok(Map.of(
                "status", "DELETION_REQUESTED",
                "gracePeriodDays", GdprService.DELETION_GRACE_DAYS,
                "message", "Hesabınız devre dışı bırakıldı. " + GdprService.DELETION_GRACE_DAYS
                        + " gün içinde verileriniz anonymize edilecek."
        ));
    }
}
