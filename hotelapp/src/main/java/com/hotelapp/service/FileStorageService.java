package com.hotelapp.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.hotelapp.exception.BusinessRuleException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Cloudinary storage. Chat originals are authenticated and delivered only by the
 * membership-checked backend proxy. Business images and avatars remain public.
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
    // #80v2 / chat refactor: Mesaj eki yükleme — image/file/audio
    // Private storage reference only; downloads require conversation membership.
    // -----------------------------------------------------------------------
    public String storeMessageAttachment(MultipartFile file, Long conversationId) {
        validate(file, ALLOWED_EXTENSIONS, MAX_FILE_SIZE,
                "Kabul edilenler: PDF, JPG, JPEG, PNG, WEBP, HEIC, DOC, DOCX",
                "Dosya çok büyük (%.1f MB). Maksimum 15 MB olmalı.");

        String ext = getExtension(file.getOriginalFilename()).toLowerCase();
        // Store originals without public previews or transformations.
        String resourceType = "raw";
        String folder = "kadrom/messages/" + conversationId;
        String publicId = folder + "/" + UUID.randomUUID() + "." + ext;

        Map<String, Object> options = ObjectUtils.asMap(
                "public_id", publicId,
                "resource_type", resourceType,
                "type", "authenticated",
                "overwrite", false,
                "use_filename", false,
                "unique_filename", false
        );

        try {
            cloudinary.uploader().upload(file.getBytes(), options);
            log.info("Cloudinary mesaj eki yüklendi: {} (size={} KB)", publicId, file.getSize() / 1024);
            return "authenticated:raw:" + publicId;
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

        String folder = "kadrom/business/" + businessId + "/" + subfolder;
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
            // Format: "upload:image:kadrom/business/.../uuid"
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

        String folder = "kadrom/avatars/" + userId;
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

    /**
     * Dosyayı ancak veritabanı işlemi başarıyla kaydedilince siler (fotoğraf değiştirme /
     * kaldırma). İşlem geri alınırsa dosya yerinde kalır; profil kırık görsele bakmaz.
     * Aktif işlem yoksa hemen siler.
     */
    public void deleteAfterCommit(String storedRef) {
        if (storedRef == null || storedRef.isBlank()) return;
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            delete(storedRef);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { delete(storedRef); }
        });
    }

    /** Yeni yüklenen dosyayı, veritabanı işlemi geri alınırsa temizler (sahipsiz dosya kalmasın). */
    public void deleteOnRollback(String storedRef) {
        if (storedRef == null || storedRef.isBlank()
                || !TransactionSynchronizationManager.isSynchronizationActive()) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status == STATUS_ROLLED_BACK) delete(storedRef);
            }
        });
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
    // Internal signed delivery URL. This signature does NOT expire.
    // Private chat URLs must never leave the backend; use readPrivateAttachment.
    // -----------------------------------------------------------------------
    public String signedUrl(String storedRef) {
        if (storedRef == null || storedRef.isBlank()) return null;
        ParsedRef ref = parseRef(storedRef);

        return cloudinary.url()
                .secure(true)
                .resourceType(ref.resourceType)
                .type(ref.type)
                .signed(true)
                .source(ref.publicId)
                .generate();
    }

    public byte[] readPrivateAttachment(String storedRef) {
        if (storedRef == null || !storedRef.startsWith("authenticated:raw:kadrom/messages/")) {
            throw new BusinessRuleException("Eski dosyanın güvenli depolamaya taşınması gerekiyor. Dosyayı sohbetten yeniden paylaşabilirsiniz.");
        }
        java.net.HttpURLConnection connection = null;
        try {
            connection = (java.net.HttpURLConnection) java.net.URI.create(signedUrl(storedRef)).toURL().openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(false);
            if (connection.getResponseCode() != 200) throw new IOException("Storage unavailable");
            try (var input = connection.getInputStream()) {
                byte[] data = input.readNBytes((int) MAX_FILE_SIZE + 1);
                if (data.length > MAX_FILE_SIZE) throw new IOException("Attachment too large");
                return data;
            }
        } catch (IOException e) {
            // Do not expose signed URLs or provider credentials in errors.
            throw new BusinessRuleException("Dosya şu anda alınamıyor. Lütfen tekrar deneyin.");
        } finally {
            if (connection != null) connection.disconnect();
        }
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
        validateMagicBytes(file, ext);
    }

    /**
     * MIME type spoofing'i önler: uzantı uygun olsa bile dosyanın gerçek formatına
     * (ilk 16 byte signature) bakar. .pdf adıyla yüklenen exe / image'a gizlenmiş
     * payload bu kontrolde takılır.
     */
    private void validateMagicBytes(MultipartFile file, String ext) {
        byte[] h;
        try (var is = file.getInputStream()) {
            h = is.readNBytes(16);
        } catch (IOException e) {
            throw new BusinessRuleException("Dosya okunamadı");
        }
        if (h.length < 4 || !matchesExtension(h, ext)) {
            throw new BusinessRuleException(
                    "Dosya içeriği '." + ext + "' uzantısıyla uyumsuz — gerçek format farklı görünüyor");
        }
    }

    private boolean matchesExtension(byte[] h, String ext) {
        return switch (ext) {
            case "pdf"        -> startsWith(h, "%PDF");
            case "png"        -> h[0] == (byte) 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47;
            case "jpg", "jpeg"-> h[0] == (byte) 0xFF && h[1] == (byte) 0xD8 && h[2] == (byte) 0xFF;
            case "webp"       -> h.length >= 12 && startsWith(h, "RIFF")
                                  && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P';
            case "heic", "heif"-> h.length >= 12
                                  && h[4] == 'f' && h[5] == 't' && h[6] == 'y' && h[7] == 'p'
                                  && isHeifBrand(new String(h, 8, 4, StandardCharsets.US_ASCII));
            case "doc"        -> h[0] == (byte) 0xD0 && h[1] == (byte) 0xCF
                                  && h[2] == 0x11 && h[3] == (byte) 0xE0;
            // DOCX = ZIP container; PK 03 04 yeterli (içeriği doğrulamak unzip ister, overkill)
            case "docx"       -> h[0] == 0x50 && h[1] == 0x4B && (h[2] == 0x03 || h[2] == 0x05 || h[2] == 0x07);
            case "ogg"        -> h[0] == 'O' && h[1] == 'g' && h[2] == 'g' && h[3] == 'S';
            // MP3: ID3 tag veya MPEG frame sync (0xFF Ex/Fx)
            case "mp3"        -> startsWith(h, "ID3")
                                  || (h[0] == (byte) 0xFF && (h[1] & 0xE0) == (byte) 0xE0);
            // M4A: ftyp + (M4A | mp42 | isom | dash)
            case "m4a"        -> h.length >= 12
                                  && h[4] == 'f' && h[5] == 't' && h[6] == 'y' && h[7] == 'p';
            case "wav"        -> h.length >= 12 && startsWith(h, "RIFF")
                                  && h[8] == 'W' && h[9] == 'A' && h[10] == 'V' && h[11] == 'E';
            // WEBM = EBML container (MKV de aynı, biz tarayıcının ürettiği audio/webm için yeterli)
            case "webm"       -> h[0] == 0x1A && h[1] == 0x45 && h[2] == (byte) 0xDF && h[3] == (byte) 0xA3;
            default           -> false;
        };
    }

    private static boolean startsWith(byte[] h, String ascii) {
        if (h.length < ascii.length()) return false;
        for (int i = 0; i < ascii.length(); i++) {
            if (h[i] != (byte) ascii.charAt(i)) return false;
        }
        return true;
    }

    private static final Set<String> HEIF_BRANDS = Set.of(
            "heic", "heix", "heim", "heis", "hevc", "hevx",
            "mif1", "msf1"
    );
    private static boolean isHeifBrand(String brand) {
        return HEIF_BRANDS.contains(brand);
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
     * Örn: "authenticated:raw:kadrom/documents/5/abc-uuid"
     *      "upload:image:kadrom/business/3/logo/xyz-uuid"
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
