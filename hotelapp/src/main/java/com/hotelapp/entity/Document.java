package com.hotelapp.entity;

import com.hotelapp.enums.DocumentType;
import com.hotelapp.security.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "documents")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentType type;

    // Dosyanın Cloudinary public_id'si.
    // FAZ H.4 — KVKK m.12: AES-GCM ile şifreli saklanır (DB dump'ta
    // hangi adayın hangi dosyayı yüklediği plain okunmasın).
    // Legacy plain değerler geri uyumludur (prefix-based detection).
    @Column(nullable = false, length = 500)
    @Convert(converter = EncryptedStringConverter.class)
    private String filePath;

    // Orijinal dosya adı — şifreli (hassas: "saglik-raporu-tckn1234.pdf" gibi)
    @Column(length = 500)
    @Convert(converter = EncryptedStringConverter.class)
    private String originalFileName;

    // true → herkes görebilir (CV, transkript)
    // false → sadece talep + onay sonrası görülebilir (adli sicil vb.)
    @Column(nullable = false)
    private boolean isSensitive;

    // Admin tarafından doğrulandı mı
    private boolean verified = false;
    private LocalDateTime verifiedAt;

    private LocalDateTime uploadedAt;

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
    }
}
