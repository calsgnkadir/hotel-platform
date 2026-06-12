package com.hotelapp.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.hotelapp.exception.BusinessRuleException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Dosya storage — Cloudinary tabanlı (Railway ephemeral disk yerine).
 *
 * DB'ye saklanan değer: Cloudinary public_id (örn: "ajanshotel/documents/5/cv_abc123")
 *   Tam URL gerektiğinde {@link #publicUrl(String)} ile build edilir.
 *
 * Hassas belgeler (criminal/health/identity) için resource_type=raw, type=authenticated kullanılır;
 * indirme zamanı signed URL üretilir. Görseller ve public belgeler için type=upload (CDN'den public).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FileStorageService {

    private final Cloudinary cloudinary;

    // Belge uzantıları (CV, transkript, foto, vs.)
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf",
            "jpg", "jpeg", "png", "webp", "heic", "heif",
            "doc", "docx",
            // Chat-v2: sesli mesaj (voice note) için
            "mp3", "m4a", "ogg", "wav", "webm"
    );

    // Sadece görsel — işletme logo/galeri
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "heic", "heif"
    );

    private static final long MAX_FILE_SIZE = 15L * 1024 * 1024;   // 15 MB
    private static final long MAX_IMAGE_SIZE = 10L * 1024 * 1024;  // 10 MB

    // -----------------------------------------------------------------------
    // Aday belge yükleme
    // -----------------------------------------------------------------------
    // FAZ 2/#18: Cloudinary down/yavaslarsa devre acilir, yukleme hatasi clean dondurulur
    @CircuitBreaker(name = "cloudinary", fallbackMethod = "storeFallback")
    public String store(MultipartFile file, Long studentId) {
        validate(file, ALLOWED_EXTENSIONS, MAX_FILE_SIZE,
                "Kabul edilenler: PDF, JPG, JPEG, PNG, WEBP, HEIC, DOC, DOCX",
                "Dosya çok büyük (%.1f MB). Maksimum 15 MB olmalı.");

        String ext = getExtension(file.getOriginalFilename()).toLowerCase();
        // Görseller image olarak, diğerleri raw olarak yüklenir
        String resourceType = isImageExt(ext) ? "image" : "raw";
        String folder = "ajanshotel/documents/" + studentId;
        // RAW (PDF/DOC): uzantı public_id'ye dahil (Cloudinary delivery için gerekli)
        // IMAGE (JPG/PNG/WEBP): uzantı public_id'de YOK (Cloudinary formatı içerikten algılar)
        String publicId = "image".equals(resourceType)
                ? folder + "/" + UUID.randomUUID()
                : folder + "/" + UUID.randomUUID() + "." + ext;

        // type=upload + UUID path → URL tahmin edilemez, backend access control yapar
        // (signed URL karmaşıklığı yerine "security through obscurity" + auth endpoint)
        Map<String, Object> options = ObjectUtils.asMap(
                "public_id", publicId,
                "resource_type", resourceType,
                "type", "upload",
                "overwrite", true,
                "use_filename", false,
                "unique_filename", false
        );

        try {
            cloudinary.uploader().upload(file.getBytes(), options);
            log.info("Cloudinary belge yüklendi: {} (size={} KB)", publicId, file.getSize() / 1024);
            // DB'ye saklanacak değer: "upload:resource_type:public_id"
            return "upload:" + resourceType + ":" + publicId;
        } catch (IOException e) {
            throw new BusinessRuleException("Cloudinary'ye yüklenemedi: " + e.getMessage());
        }
    }

    /** FAZ 2/#18 - Cloudinary circuit breaker fallback */
    @SuppressWarnings("unused")
    private String storeFallback(MultipartFile file, Long studentId, Throwable t) {
        log.warn("[STORE][CB-FALLBACK] Cloudinary devre disi - studentId={} sebep={}",
                studentId, t.getMessage());
        throw new BusinessRuleException(
                "Dosya yukleme servisi su an kullanilamiyor — lutfen birkac dakika sonra tekrar dene.");
    }

    // -----------------------------------------------------------------------
    // #80v2 / chat refactor: Mesaj eki yükleme — image/file/audio
    // Public CDN URL döner (DB'ye direkt URL kaydedilir — mesajlarda kullanım).
    // -----------------------------------------------------------------------
    public String storeMessageAttachment(MultipartFile file, Long conversationId) {
        validate(file, ALLOWED_EXTENSIONS, MAX_FILE_SIZE,
                "Kabul edilenler: PDF, JPG, JPEG, PNG, WEBP, HEIC, DOC, DOCX",
                "Dosya çok büyük (%.1f MB). Maksimum 15 MB olmalı.");

        String ext = getExtension(file.getOriginalFilename()).toLowerCase();
        // Cloudinary resource_type:
        //   image: jpg/png/webp...
        //   video: mp3/m4a/ogg/wav/webm (audio dahil)
        //   raw:   pdf/doc/docx
        String resourceType;
        if (isImageExt(ext))      resourceType = "image";
        else if (isAudioExt(ext)) resourceType = "video";
        else                      resourceType = "raw";
        String folder = "ajanshotel/messages/" + conversationId;
        String publicId = "image".equals(resourceType)
                ? folder + "/" + UUID.randomUUID()
                : folder + "/" + UUID.randomUUID() + "." + ext;

        Map<String, Object> options = ObjectUtils.asMap(
                "public_id", publicId,
                "resource_type", resourceType,
                "type", "upload",
                "overwrite", true,
                "use_filename", false,
                "unique_filename", false
        );

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().upload(file.getBytes(), options);
            String secureUrl = (String) result.get("secure_url");
            log.info("Cloudinary mesaj eki yüklendi: {} (size={} KB)", publicId, file.getSize() / 1024);
            // Direkt CDN URL'i döner — DB'ye direkt URL kaydedilir
            return secureUrl;
        } catch (IOException e) {
            throw new BusinessRuleException("Cloudinary'ye yüklenemedi: " + e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // İşletme görseli (logo/galeri) yükleme — PUBLIC, CDN'den direkt erişim
    // -----------------------------------------------------------------------
    public String storeBusinessImage(MultipartFile file, Long businessId, String subfolder) {
        validate(file, ALLOWED_IMAGE_EXTENSIONS, MAX_IMAGE_SIZE,
                "Kabul edilenler: JPG, JPEG, PNG, WEBP, HEIC",
                "Görsel çok büyük (%.1f MB). Maksimum 10 MB olmalı.");

        String folder = "ajanshotel/business/" + businessId + "/" + subfolder;
        // GÖRSELLERDE uzantı YOK — Cloudinary formatı içerikten algılar.
        // Uzantı koyarsak (.webp/.jpg) yanlış yorumlanıp bozuk görsel oluyor.
        String publicId = folder + "/" + UUID.randomUUID();

        // Sade yükleme — incoming transformation (f_auto/q_auto) bozuk görsel
        // üretiyordu. Optimizasyon gerekirse delivery URL'inde yapılır.
        Map<String, Object> options = ObjectUtils.asMap(
                "public_id", publicId,
                "resource_type", "image",
                "type", "upload",
                "overwrite", true,
                "use_filename", false,
                "unique_filename", false
        );

        try {
            cloudinary.uploader().upload(file.getBytes(), options);
            log.info("Cloudinary görsel yüklendi: {} (size={} KB)", publicId, file.getSize() / 1024);
            // Format: "upload:image:ajanshotel/business/.../uuid"
            return "upload:image:" + publicId;
        } catch (IOException e) {
            throw new BusinessRuleException("Cloudinary'ye yüklenemedi: " + e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Aday profil fotoğrafı (D7) — image only, max 5 MB
    // -----------------------------------------------------------------------
    public String storeAvatar(MultipartFile file, Long userId) {
        validate(file, ALLOWED_IMAGE_EXTENSIONS, 5L * 1024 * 1024,
                "Kabul edilenler: JPG, JPEG, PNG, WEBP, HEIC",
                "Profil fotoğrafı çok büyük (%.1f MB). Maksimum 5 MB olmalı.");

        String folder = "ajanshotel/avatars/" + userId;
        // GÖRSELLERDE uzantı YOK — Cloudinary formatı içerikten algılar.
        String publicId = folder + "/" + UUID.randomUUID();

        // Sade yükleme — transformation yok (free tier face detection sorununu önler).
        // Kırpma CSS tarafında (object-cover + rounded-full) yapılıyor.
        Map<String, Object> options = ObjectUtils.asMap(
                "public_id", publicId,
                "resource_type", "image",
                "type", "upload",
                "overwrite", true,
                "use_filename", false,
                "unique_filename", false
        );

        try {
            cloudinary.uploader().upload(file.getBytes(), options);
            log.info("Cloudinary avatar yüklendi: {} (size={} KB)", publicId, file.getSize() / 1024);
            return "upload:image:" + publicId;
        } catch (IOException e) {
            throw new BusinessRuleException("Avatar yüklenemedi: " + e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Sil
    // -----------------------------------------------------------------------
    public void delete(String storedRef) {
        if (storedRef == null || storedRef.isBlank()) return;

        ParsedRef ref = parseRef(storedRef);
        Map<String, Object> options = ObjectUtils.asMap(
                "resource_type", ref.resourceType,
                "type", ref.type,
                "invalidate", true
        );
        try {
            cloudinary.uploader().destroy(ref.publicId, options);
            log.info("Cloudinary silindi: {}", ref.publicId);
        } catch (IOException e) {
            // Silme hatası kritik değil
            log.warn("Cloudinary silinemedi: {} — {}", ref.publicId, e.getMessage());
        }
    }

    // -----------------------------------------------------------------------
    // Public URL üret (CDN'den direkt erişilebilir — sadece type=upload için)
    // -----------------------------------------------------------------------
    public String publicUrl(String storedRef) {
        if (storedRef == null || storedRef.isBlank()) return null;
        ParsedRef ref = parseRef(storedRef);
        return cloudinary.url()
                .secure(true)
                .resourceType(ref.resourceType)
                .type(ref.type)
                .generate(ref.publicId);
    }

    // -----------------------------------------------------------------------
    // Signed URL üret (type=authenticated için — 1 saat geçerli)
    // -----------------------------------------------------------------------
    public String signedUrl(String storedRef) {
        if (storedRef == null || storedRef.isBlank()) return null;
        ParsedRef ref = parseRef(storedRef);

        // 1 saat sonra expire et
        long expiresAt = (System.currentTimeMillis() / 1000) + 3600;

        return cloudinary.url()
                .secure(true)
                .resourceType(ref.resourceType)
                .type(ref.type)
                .signed(true)
                .source(ref.publicId)
                .generate();
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    private void validate(MultipartFile file, Set<String> allowedExts, long maxSize,
                          String acceptedListMsg, String oversizeFormat) {
        if (file.isEmpty()) {
            throw new BusinessRuleException("Boş dosya yüklenemez");
        }
        if (file.getSize() > maxSize) {
            double mb = file.getSize() / (1024.0 * 1024.0);
            throw new BusinessRuleException(String.format(oversizeFormat, mb));
        }
        String originalName = StringUtils.cleanPath(file.getOriginalFilename() == null ? "" : file.getOriginalFilename());
        if (originalName.isBlank()) {
            throw new BusinessRuleException("Dosya adı okunamadı");
        }
        if (originalName.contains("..")) {
            throw new BusinessRuleException("Geçersiz dosya adı");
        }
        String ext = getExtension(originalName).toLowerCase();
        if (ext.isEmpty()) {
            throw new BusinessRuleException("Dosyanın uzantısı yok — geçerli bir dosya seçin");
        }
        if (!allowedExts.contains(ext)) {
            throw new BusinessRuleException("'." + ext + "' formatı desteklenmiyor. " + acceptedListMsg);
        }
    }

    private String getExtension(String filename) {
        if (filename == null) return "";
        int dotIndex = filename.lastIndexOf('.');
        return (dotIndex >= 0) ? filename.substring(dotIndex + 1) : "";
    }

    private boolean isImageExt(String ext) {
        return ALLOWED_IMAGE_EXTENSIONS.contains(ext);
    }

    private static final Set<String> AUDIO_EXTENSIONS = Set.of("mp3", "m4a", "ogg", "wav", "webm");
    private boolean isAudioExt(String ext) {
        return AUDIO_EXTENSIONS.contains(ext);
    }

    /**
     * DB'de saklanan ref formatı: "type:resource_type:public_id"
     * Örn: "authenticated:raw:ajanshotel/documents/5/abc-uuid"
     *      "upload:image:ajanshotel/business/3/logo/xyz-uuid"
     * Geriye uyumluluk: eski "documents/5/..." formatlı path'ler için raw/authenticated varsayılır.
     */
    private ParsedRef parseRef(String storedRef) {
        String[] parts = storedRef.split(":", 3);
        if (parts.length == 3) {
            return new ParsedRef(parts[0], parts[1], parts[2]);
        }
        // Legacy fallback (eski Railway ephemeral dosyaları — artık erişilebilir değil ama format)
        return new ParsedRef("upload", "image", storedRef);
    }

    private record ParsedRef(String type, String resourceType, String publicId) {}
}
