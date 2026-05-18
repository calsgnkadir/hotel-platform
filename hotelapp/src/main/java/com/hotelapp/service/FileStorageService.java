package com.hotelapp.service;

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
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "jpg", "jpeg", "png"
    );

    // Sadece görsel — işletme logo/galeri
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
            "jpg", "jpeg", "png", "webp"
    );

    // Maksimum dosya boyutu: 10 MB (belge)
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024;

    // Maksimum görsel boyutu: 5 MB
    private static final long MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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
            throw new RuntimeException("Boş dosya yüklenemez");
        }

        // Boyut kontrolü
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new RuntimeException("Dosya boyutu 10 MB'ı aşamaz");
        }

        // Uzantı kontrolü
        String originalName = StringUtils.cleanPath(file.getOriginalFilename());
        String extension = getExtension(originalName).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new RuntimeException("Sadece PDF, JPG, JPEG, PNG yüklenebilir");
        }

        // Path traversal koruması
        if (originalName.contains("..")) {
            throw new RuntimeException("Geçersiz dosya adı");
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
            throw new RuntimeException("Dosya kaydedilemedi: " + e.getMessage());
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
            throw new RuntimeException("Boş dosya yüklenemez");
        }
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new RuntimeException("Görsel boyutu 5 MB'ı aşamaz");
        }

        String originalName = StringUtils.cleanPath(file.getOriginalFilename());
        String extension = getExtension(originalName).toLowerCase();
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            throw new RuntimeException("Sadece JPG, JPEG, PNG, WEBP yüklenebilir");
        }
        if (originalName.contains("..")) {
            throw new RuntimeException("Geçersiz dosya adı");
        }

        try {
            Path dir = Paths.get(uploadDir, "business", businessId.toString(), subfolder);
            Files.createDirectories(dir);

            String uniqueName = UUID.randomUUID() + "_" + originalName;
            Path targetPath = dir.resolve(uniqueName);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

            return "business/" + businessId + "/" + subfolder + "/" + uniqueName;
        } catch (IOException e) {
            throw new RuntimeException("Görsel kaydedilemedi: " + e.getMessage());
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
