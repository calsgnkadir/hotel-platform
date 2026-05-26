package com.hotelapp.service;

import com.hotelapp.exception.BusinessRuleException;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    @Value("${file.upload-dir}")
    private String uploadDir;

    // İzin verilen dosya uzantıları (belgeler)
    // PDF + her tipte foto (HEIC iPhone, WebP modern, DOC/DOCX Office)
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf",
            "jpg", "jpeg", "png", "webp", "heic", "heif",
            "doc", "docx"
    );

    // Sadece görsel — işletme logo/galeri
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp", "heic", "heif"
    );

    // Maksimum dosya boyutu: 15 MB (belge — modern telefon foto + PDF için)
    private static final long MAX_FILE_SIZE = 15L * 1024 * 1024;

    // Maksimum görsel boyutu: 10 MB (modern foto için)
    private static final long MAX_IMAGE_SIZE = 10L * 1024 * 1024;

    @PostConstruct
    public void init() throws IOException {
        // Uygulama başlarken klasörü oluştur
        Files.createDirectories(Paths.get(uploadDir));
        Files.createDirectories(Paths.get(uploadDir, "documents"));
        Files.createDirectories(Paths.get(uploadDir, "business"));
    }

    /**
     * Dosyayı diske kaydeder ve kaydedilen yolu döner.
     * Dosya adı: {UUID}_{orijinal-ad} — çakışma ve path traversal riskini önler.
     */
    public String store(MultipartFile file, Long studentId) {
        // Boş dosya kontrolü
        if (file.isEmpty()) {
            throw new BusinessRuleException("Boş dosya yüklenemez");
        }

        // Boyut kontrolü
        if (file.getSize() > MAX_FILE_SIZE) {
            double mb = file.getSize() / (1024.0 * 1024.0);
            throw new BusinessRuleException(
                    String.format("Dosya çok büyük (%.1f MB). Maksimum 15 MB olmalı.", mb));
        }

        // Uzantı kontrolü
        String originalName = StringUtils.cleanPath(file.getOriginalFilename());
        if (originalName == null || originalName.isBlank()) {
            throw new BusinessRuleException("Dosya adı okunamadı");
        }
        String extension = getExtension(originalName).toLowerCase();
        if (extension.isEmpty()) {
            throw new BusinessRuleException("Dosyanın uzantısı yok — geçerli bir dosya seçin");
        }
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessRuleException(
                    "'." + extension + "' formatı desteklenmiyor. " +
                    "Kabul edilenler: PDF, JPG, JPEG, PNG, WEBP, HEIC, DOC, DOCX");
        }

        // Path traversal koruması
        if (originalName.contains("..")) {
            throw new BusinessRuleException("Geçersiz dosya adı");
        }

        // Öğrenciye özel klasör: uploads/documents/{studentId}/
        try {
            Path studentDir = Paths.get(uploadDir, "documents", studentId.toString());
            Files.createDirectories(studentDir);

            String uniqueName = UUID.randomUUID() + "_" + originalName;
            Path targetPath = studentDir.resolve(uniqueName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            // DB'ye kaydedilecek relative path
            return "documents/" + studentId + "/" + uniqueName;

        } catch (IOException e) {
            throw new BusinessRuleException("Dosya kaydedilemedi: " + e.getMessage());
        }
    }

    /**
     * Dosyayı diskten siler.
     */
    public void delete(String filePath) {
        try {
            Path path = Paths.get(uploadDir, filePath);
            Files.deleteIfExists(path);
        } catch (IOException e) {
            // Silme hatası kritik değil, loglanır geçilir
            System.err.println("Dosya silinemedi: " + filePath + " - " + e.getMessage());
        }
    }

    /**
     * İşletme görseli kaydet (logo veya galeri).
     * @param subfolder "logo" veya "gallery"
     * @return relative path: "business/{businessId}/{subfolder}/{uuid}_{name}"
     */
    public String storeBusinessImage(MultipartFile file, Long businessId, String subfolder) {
        if (file.isEmpty()) {
            throw new BusinessRuleException("Boş dosya yüklenemez");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            double mb = file.getSize() / (1024.0 * 1024.0);
            throw new BusinessRuleException(
                    String.format("Görsel çok büyük (%.1f MB). Maksimum 10 MB olmalı.", mb));
        }

        String originalName = StringUtils.cleanPath(file.getOriginalFilename());
        if (originalName == null || originalName.isBlank()) {
            throw new BusinessRuleException("Dosya adı okunamadı");
        }
        String extension = getExtension(originalName).toLowerCase();
        if (extension.isEmpty()) {
            throw new BusinessRuleException("Dosyanın uzantısı yok — geçerli bir dosya seçin");
        }
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            throw new BusinessRuleException(
                    "'." + extension + "' formatı desteklenmiyor. " +
                    "Kabul edilenler: JPG, JPEG, PNG, WEBP, HEIC");
        }
        if (originalName.contains("..")) {
            throw new BusinessRuleException("Geçersiz dosya adı");
        }

        try {
            Path dir = Paths.get(uploadDir, "business", businessId.toString(), subfolder);
            Files.createDirectories(dir);

            String uniqueName = UUID.randomUUID() + "_" + originalName;
            Path targetPath = dir.resolve(uniqueName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            return "business/" + businessId + "/" + subfolder + "/" + uniqueName;
        } catch (IOException e) {
            throw new BusinessRuleException("Görsel kaydedilemedi: " + e.getMessage());
        }
    }

    /**
     * Dosyanın tam disk yolunu döner (indirme/görüntüleme için).
     */
    public Path getFullPath(String filePath) {
        return Paths.get(uploadDir, filePath).normalize();
    }

    private String getExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        return (dotIndex >= 0) ? filename.substring(dotIndex + 1) : "";
    }
}
