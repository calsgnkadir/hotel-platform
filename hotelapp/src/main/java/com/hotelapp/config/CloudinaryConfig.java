package com.hotelapp.config;

import com.cloudinary.Cloudinary;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Cloudinary entegrasyonu — kalıcı dosya/foto storage.
 *
 * CLOUDINARY_URL formatı: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 * Dev'de application.yml'a default verilebilir.
 * Prod'da Railway env var olarak gelir.
 */
@Configuration
public class CloudinaryConfig {

    @Value("${cloudinary.url:}")
    private String cloudinaryUrl;

    @Bean
    public Cloudinary cloudinary() {
        if (cloudinaryUrl == null || cloudinaryUrl.isBlank()) {
            throw new IllegalStateException(
                    "CLOUDINARY_URL env var tanımlı değil. " +
                    "Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME");
        }
        // Cloudinary SDK URL'yi parse eder, ayrıca secure=true zorlanır
        Cloudinary cloudinary = new Cloudinary(cloudinaryUrl);
        cloudinary.config.secure = true;
        return cloudinary;
    }
}
