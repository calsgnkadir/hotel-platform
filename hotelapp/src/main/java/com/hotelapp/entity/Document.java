package com.hotelapp.entity;

import com.hotelapp.enums.DocumentType;
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

    // Dosyanın diskteki yolu (ya da S3 bucket key)
    @Column(nullable = false)
    private String filePath;

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
