package com.hotelapp.controller;

import com.hotelapp.entity.User;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.service.BusinessService;
import com.hotelapp.service.BusinessService.BusinessDto;
import com.hotelapp.service.BusinessService.PhotoDto;
import com.hotelapp.service.BusinessService.ProfileUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
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

    @Operation(summary = "İşletme detay (public, paylaşılabilir profil) — FAZ 5.9")
    @GetMapping("/api/businesses/{id}")
    public ResponseEntity<BusinessDto> getPublicBusiness(@PathVariable Long id) {
        return ResponseEntity.ok(businessService.getPublicById(id));
    }

    @Operation(summary = "Logo URL'sine yönlendir (legacy — yeni frontend BusinessDto.logoUrl'i direkt kullanır)")
    @GetMapping("/api/businesses/{id}/logo")
    public ResponseEntity<Void> getLogo(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(businessService.getLogoRedirectUrl(id)))
                .build();
    }

    @Operation(summary = "Galeri foto URL'sine yönlendir (legacy)")
    @GetMapping("/api/businesses/photos/{photoId}")
    public ResponseEntity<Void> getGalleryPhoto(@PathVariable Long photoId) {
        return ResponseEntity.status(HttpStatus.FOUND)
                .location(URI.create(businessService.getGalleryPhotoRedirectUrl(photoId)))
                .build();
    }

    // ================================================================
    // OWNER — profil, logo, galeri yönetimi
    // ================================================================

    @Operation(summary = "Kendi profilim — sadece BUSINESS_OWNER")
    @GetMapping("/api/business/profile")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<BusinessDto> getMyProfile(@AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        return ResponseEntity.ok(businessService.getMyProfile(currentUser.getId()));
    }

    @Operation(summary = "Profil güncelle — sadece BUSINESS_OWNER")
    @PutMapping("/api/business/profile")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<BusinessDto> updateMyProfile(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @Valid @RequestBody ProfileUpdateRequest request) {
        return ResponseEntity.ok(businessService.updateMyProfile(currentUser.getId(), request));
    }

    @Operation(summary = "Logo yükle/değiştir (multipart 'file') — sadece BUSINESS_OWNER")
    @PostMapping(value = "/api/business/logo", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<BusinessDto> uploadLogo(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(businessService.uploadLogo(currentUser.getId(), file));
    }

    @Operation(summary = "Logoyu sil — sadece BUSINESS_OWNER")
    @DeleteMapping("/api/business/logo")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> deleteLogo(@AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        businessService.deleteLogo(currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Kendi galeri fotolarımı listele — sadece BUSINESS_OWNER")
    @GetMapping("/api/business/photos")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<PhotoDto>> getMyGallery(@AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser) {
        return ResponseEntity.ok(businessService.getMyGalleryPhotos(currentUser.getId()));
    }

    @Operation(summary = "Galeriye yeni foto ekle (multipart 'file') — sadece BUSINESS_OWNER")
    @PostMapping(value = "/api/business/photos", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<PhotoDto> uploadGalleryPhoto(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(businessService.uploadGalleryPhoto(currentUser.getId(), file));
    }

    @Operation(summary = "Galeri fotosunu sil — sadece BUSINESS_OWNER (sahibi)")
    @DeleteMapping("/api/business/photos/{photoId}")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<Void> deleteGalleryPhoto(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long photoId) {
        businessService.deleteGalleryPhoto(currentUser.getId(), photoId);
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Galeri sıralamasını değiştir — sadece BUSINESS_OWNER",
            description = "Body: foto id'lerinin yeni sırasıyla dizi."
    )
    @PutMapping("/api/business/photos/order")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<List<PhotoDto>> reorderGallery(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @RequestBody List<Long> orderedPhotoIds) {
        return ResponseEntity.ok(
                businessService.reorderGallery(currentUser.getId(), orderedPhotoIds));
    }

    @Operation(summary = "Kapak fotoğrafı belirle — sadece BUSINESS_OWNER (sahibi)")
    @PutMapping("/api/business/photos/{photoId}/cover")
    @PreAuthorize("hasRole('BUSINESS_OWNER')")
    @SecurityRequirement(name = "bearerAuth")
    public ResponseEntity<PhotoDto> setCoverPhoto(
            @AuthenticationPrincipal com.hotelapp.security.UserPrincipal currentUser,
            @PathVariable Long photoId) {
        return ResponseEntity.ok(
                businessService.setCoverPhoto(currentUser.getId(), photoId));
    }
}
