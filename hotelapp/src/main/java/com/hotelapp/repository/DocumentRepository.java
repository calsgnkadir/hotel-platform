package com.hotelapp.repository;

import com.hotelapp.entity.Document;
import com.hotelapp.enums.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findAllByStudentId(Long studentId);
    List<Document> findAllByStudentIdAndIsSensitiveFalse(Long studentId);  // herkese açık belgeler
    Optional<Document> findByStudentIdAndType(Long studentId, DocumentType type);
}
