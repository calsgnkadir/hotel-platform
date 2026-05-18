package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.service.BusinessService;
import com.hotelapp.service.BusinessService.BusinessDto;
import com.hotelapp.service.BusinessService.LoadedFile;
import com.hotelapp.service.BusinessService.PhotoDto;
import com.hotelapp.service.BusinessService.ProfileUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
@Tag(name = "5. İşletmeler", description = "İşletme listeleme (public) ve profil + foto yönetimi (owner)")
public class BusinessController {

    private final BusinessService businessService;

    // ================================================================
    // PUBLIC — listeleme, foto bytes serving
    // ================================================================

    @Operation(summary = "İşletmeleri listele")
    @GetMapping("/api/businesses")
    public ResponseEntity<List<BusinessDto>> listBusinesses(
            @RequestParam(required = false) BusinessType type) {
        return ResponseEntity.ok(businessService.getAllBusinesses(type));
    }

    @Operation(summary = "İşletmenin galeri foto listesi (public)")
    @GetMapping("/api/businesses/{id}/photos")
    public ResponseEntity<List<PhotoDto>> getBusinessGallery(@PathVariable Long id) {
        return ResponseEntity.ok(businessService.getGalleryPhotosForBusiness(id));
    }

    @Operation(summary = "Logo dosyasını ham byte olarak getir (public)")
    @GetMapping("/api/businesses/{id}/logo")
    public ResponseEntity<Resource> getLogoBytes(@PathVariable Long id) {
        LoadedFile lf = businessService.loadLogo(id);
        return ResponseEntity.ok().contentType(lf.mediaType()).body(lf.resource());
    }

    @Operation(summary = "Galeri foto dosyasını ham byte olarak getir (public)")
    @GetMapping("/api/businesses/photos/{photoId}")
    public ResponseEntity<Resource> getGalleryPhotoBytes(@PathVariable Long photoId) {
        LoadedFile lf = businessService.loadGalleryPhoto(photoId);
        return ResponseEntity.ok().contentType(lf.mediaType()).body(lf.resource());
    }

    // ================================================================
    // OWNER — profil, logo, galeri yönetimi
    // ================================================================

    @Operation(summary = "Kendi profilim — sadece BUSINESS_OWNER")
    @GetMapping("/api/business/profile")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<BusinessDto> getMyProfile(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(businessService.getMyProfile(currentUser.getId()));
    }

    @Operation(summary = "Profil güncelle — sadece BUSINESS_OWNER")
    @PutMapping("/api/business/profile")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<BusinessDto> updateMyProfile(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody ProfileUpdateRequest request) {
        return ResponseEntity.ok(businessService.updateMyProfile(currentUser.getId(), request));
    }

    @Operation(summary = "Logo yükle/değiştir (multipart 'file') — sadece BUSINESS_OWNER")
    @PostMapping(value = "/api/business/logo", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<BusinessDto> uploadLogo(
            @AuthenticationPrincipal User currentUser,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(businessService.uploadLogo(currentUser.getId(), file));
    }

    @Operation(summary = "Logoyu sil — sadece BUSINESS_OWNER")
    @DeleteMapping("/api/business/logo")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> deleteLogo(@AuthenticationPrincipal User currentUser) {
        businessService.deleteLogo(currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Kendi galeri fotolarımı listele — sadece BUSINESS_OWNER")
    @GetMapping("/api/business/photos")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<PhotoDto>> getMyGallery(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(businessService.getMyGalleryPhotos(currentUser.getId()));
    }

    @Operation(summary = "Galeriye yeni foto ekle (multipart 'file') — sadece BUSINESS_OWNER")
    @PostMapping(value = "/api/business/photos", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<PhotoDto> uploadGalleryPhoto(
            @AuthenticationPrincipal User currentUser,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(businessService.uploadGalleryPhoto(currentUser.getId(), file));
    }

    @Operation(summary = "Galeri fotosunu sil — sadece BUSINESS_OWNER (sahibi)")
    @DeleteMapping("/api/business/photos/{photoId}")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> deleteGalleryPhoto(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long photoId) {
        businessService.deleteGalleryPhoto(currentUser.getId(), photoId);
        return ResponseEntity.noContent().build();
    }
}
