package com.hotelapp.service;

import com.hotelapp.entity.Business;
import com.hotelapp.entity.BusinessPhoto;
import com.hotelapp.enums.BusinessType;
import com.hotelapp.exception.BusinessRuleException;
import com.hotelapp.exception.ResourceNotFoundException;
import com.hotelapp.exception.UnauthorizedException;
import com.hotelapp.repository.BusinessPhotoRepository;
import com.hotelapp.repository.BusinessRepository;
import com.hotelapp.validation.TurkeyPhone;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BusinessService {

    private final BusinessRepository businessRepository;
    private final BusinessPhotoRepository businessPhotoRepository;
    private final FileStorageService fileStorageService;
    private final ReviewService reviewService;

    // Maksimum galeri foto sayısı per işletme
    private static final int MAX_GALLERY_PHOTOS = 10;

    // ----------------------------------------------------------------
    // Public: list all businesses
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public List<BusinessDto> getAllBusinesses(BusinessType type) {
        List<Business> businesses = (type != null)
                ? businessRepository.findAllByType(type)
                : businessRepository.findAll();
        return businesses.stream().map(this::toDto).toList();
    }

    // ----------------------------------------------------------------
    // Owner: get own profile
    // ----------------------------------------------------------------
    @Transactional(readOnly = true)
    public BusinessDto getMyProfile(Long ownerId) {
        Business business = businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("İşletme profili", ownerId));
        return toDto(business);
    }

    // ----------------------------------------------------------------
    // Owner: update own profile (text fields only — fotolar ayrı endpoint)
    // ----------------------------------------------------------------
    @Transactional
    public BusinessDto updateMyProfile(Long ownerId, ProfileUpdateRequest req) {
        Business business = businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("İşletme profili", ownerId));

        business.setName(req.getName());
        business.setType(req.getType());
        business.setDistrict(req.getDistrict());
        business.setNeighborhood(req.getNeighborhood());
        business.setAddress(req.getAddress());
        business.setDescription(req.getDescription());
        business.setPhone(req.getPhone());
        business.setWebsite(req.getWebsite());
        business.setCategory(req.getCategory());
        business.setInstagram(req.getInstagram());
        business.setFacebook(req.getFacebook());
        business.setWorkingHours(req.getWorkingHours());

        businessRepository.save(business);
        return toDto(business);
    }

    // ================================================================
    // LOGO
    // ================================================================

    @Transactional
    public BusinessDto uploadLogo(Long ownerId, MultipartFile file) {
        Business business = businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("İşletme profili", ownerId));

        // Eski logoyu sil
        if (business.getLogoPath() != null) {
            fileStorageService.delete(business.getLogoPath());
        }

        String path = fileStorageService.storeBusinessImage(file, business.getId(), "logo");
        business.setLogoPath(path);
        businessRepository.save(business);
        return toDto(business);
    }

    @Transactional
    public void deleteLogo(Long ownerId) {
        Business business = businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("İşletme profili", ownerId));

        if (business.getLogoPath() != null) {
            fileStorageService.delete(business.getLogoPath());
            business.setLogoPath(null);
            businessRepository.save(business);
        }
    }

    // ================================================================
    // GALLERY
    // ================================================================

    @Transactional(readOnly = true)
    public List<PhotoDto> getMyGalleryPhotos(Long ownerId) {
        Business business = businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("İşletme profili", ownerId));
        return getGalleryPhotosForBusiness(business.getId());
    }

    @Transactional(readOnly = true)
    public List<PhotoDto> getGalleryPhotosForBusiness(Long businessId) {
        return businessPhotoRepository.findAllByBusinessIdOrderByCreatedAtDesc(businessId)
                .stream()
                .map(p -> new PhotoDto(p.getId(), fileStorageService.publicUrl(p.getFilePath())))
                .toList();
    }

    @Transactional
    public PhotoDto uploadGalleryPhoto(Long ownerId, MultipartFile file) {
        Business business = businessRepository.findByOwnerId(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("İşletme profili", ownerId));

        long currentCount = businessPhotoRepository
                .findAllByBusinessIdOrderByCreatedAtDesc(business.getId()).size();
        if (currentCount >= MAX_GALLERY_PHOTOS) {
            throw new BusinessRuleException("Galeri en fazla " + MAX_GALLERY_PHOTOS + " foto tutabilir");
        }

        String path = fileStorageService.storeBusinessImage(file, business.getId(), "gallery");
        BusinessPhoto photo = BusinessPhoto.builder()
                .business(business)
                .filePath(path)
                .build();
        businessPhotoRepository.save(photo);
        return new PhotoDto(photo.getId(), fileStorageService.publicUrl(photo.getFilePath()));
    }

    @Transactional
    public void deleteGalleryPhoto(Long ownerId, Long photoId) {
        BusinessPhoto photo = businessPhotoRepository.findById(photoId)
                .orElseThrow(() -> new ResourceNotFoundException("Foto", photoId));

        if (!photo.getBusiness().getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Bu foto size ait değil");
        }

        fileStorageService.delete(photo.getFilePath());
        businessPhotoRepository.delete(photo);
    }

    // ================================================================
    // FILE SERVING — Cloudinary URL redirect (legacy endpoint backward compat)
    // ================================================================

    /**
     * Eski endpoint /api/businesses/{id}/logo için Cloudinary URL'sini döner.
     * Yeni frontend zaten DTO'daki logoUrl'yi (Cloudinary) direkt kullanır.
     */
    @Transactional(readOnly = true)
    public String getLogoRedirectUrl(Long businessId) {
        Business business = businessRepository.findById(businessId)
                .orElseThrow(() -> new ResourceNotFoundException("İşletme", businessId));
        if (business.getLogoPath() == null) {
            throw new ResourceNotFoundException("Logo", businessId);
        }
        return fileStorageService.publicUrl(business.getLogoPath());
    }

    @Transactional(readOnly = true)
    public String getGalleryPhotoRedirectUrl(Long photoId) {
        BusinessPhoto photo = businessPhotoRepository.findById(photoId)
                .orElseThrow(() -> new ResourceNotFoundException("Foto", photoId));
        return fileStorageService.publicUrl(photo.getFilePath());
    }

    // ----------------------------------------------------------------
    // Mapping
    // ----------------------------------------------------------------
    private BusinessDto toDto(Business b) {
        var rating = reviewService.getBusinessRating(b.getId());
        return BusinessDto.builder()
                .id(b.getId())
                .name(b.getName())
                .type(b.getType().name())
                .city(b.getCity())
                .district(b.getDistrict())
                .neighborhood(b.getNeighborhood())
                .address(b.getAddress())
                .description(b.getDescription())
                .phone(b.getPhone())
                .website(b.getWebsite())
                .category(b.getCategory())
                .instagram(b.getInstagram())
                .facebook(b.getFacebook())
                .workingHours(b.getWorkingHours())
                .logoUrl(b.getLogoPath() != null
                        ? fileStorageService.publicUrl(b.getLogoPath())
                        : null)
                .averageRating(rating.getAverageRating())
                .reviewCount(rating.getReviewCount())
                .build();
    }

    // ----------------------------------------------------------------
    // DTOs / records
    // ----------------------------------------------------------------
    @Data @Builder
    public static class BusinessDto {
        private Long id;
        private String name;
        private String type;
        private String city;
        private String district;
        private String neighborhood;
        private String address;
        private String description;
        private String phone;
        private String website;
        private String category;
        private String instagram;
        private String facebook;
        private String workingHours;
        private String logoUrl;
        // R3
        private Double averageRating;  // null = yorum yok
        private Long reviewCount;
    }

    @Data
    public static class ProfileUpdateRequest {
        @NotBlank private String name;
        @NotNull  private BusinessType type;
        private String district;
        private String neighborhood;
        private String address;
        private String description;

        /** İşletme telefonu — mobil veya sabit hat (0212/0216/...) ikisi de kabul. */
        @TurkeyPhone(message = "Geçerli bir telefon numarası girin (örn: 0212 555 12 34)")
        private String phone;

        private String website;
        private String category;
        private String instagram;
        private String facebook;
        private String workingHours;
    }

    public record PhotoDto(Long id, String url) {}
}
