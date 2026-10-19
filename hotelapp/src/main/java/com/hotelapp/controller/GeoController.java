package com.hotelapp.controller;

import com.hotelapp.service.GeoSearchService;
import com.hotelapp.service.GeoSearchService.GeoResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Adres arama — yalnız giriş yapmış kullanıcı, yalnız "Ara" eyleminde (otomatik
 * tamamlama için değil). Yanıt: {@code [{lat, lon, displayName}]}, en fazla 5.
 */
@RestController
@RequestMapping("/api/geo")
@RequiredArgsConstructor
@Tag(name = "Adres arama", description = "Nominatim üzerinden Türkiye adres araması (sunucu tarafı)")
public class GeoController {

    private final GeoSearchService geoSearchService;

    @Operation(summary = "Adres ara (en fazla 5 sonuç, Türkiye)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Sonuç listesi (bulunamazsa boş liste)"),
        @ApiResponse(responseCode = "422", description = "Sorgu 3 karakterden kısa ya da çok uzun"),
        @ApiResponse(responseCode = "503", description = "Arama yoğun ya da sağlayıcı yanıt vermiyor (Türkçe mesaj)")
    })
    @GetMapping("/search")
    @PreAuthorize("isAuthenticated()")
    @SecurityRequirement(name = "bearerAuth")
    public List<GeoResult> search(@RequestParam("q") String q) {
        return geoSearchService.search(q);
    }
}
