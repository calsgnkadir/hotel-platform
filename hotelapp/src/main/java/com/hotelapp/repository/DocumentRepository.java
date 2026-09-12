package com.hotelapp.repository;

import com.hotelapp.entity.Document;
import com.hotelapp.enums.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findAllByStudentId(Long studentId);
    List<Document> findAllByStudentIdAndIsSensitiveFalse(Long studentId);  // herkese açık belgeler
    Optional<Document> findByStudentIdAndType(Long studentId, DocumentType type);

    /**
     * Son-kullanma hatırlatıcısı: son kullanma tarihi eşik gününde veya öncesinde olan
     * ve daha önce hatırlatma gönderilmemiş belgeler. Süresi geçmiş ama hiç hatırlatılmamış
     * belgeler de yakalanır (expires_at <= threshold).
     */
    @Query("""
           select d from Document d
           where d.expiresAt is not null
             and d.expiryReminderSentAt is null
             and d.expiresAt <= :threshold
           """)
    List<Document> findExpiringNeedingReminder(@Param("threshold") LocalDate threshold);

    /**
     * İşletmenin "belgesi geçerli" filtresi: adayın verilen tipte, süresi geçmemiş
     * bir belgesi var mı? Son kullanma tarihi girilmemiş (null) belge de geçerli sayılır.
     */
    @Query("""
           select case when count(d) > 0 then true else false end from Document d
           where d.student.id = :candidateId
             and d.type = :type
             and (d.expiresAt is null or d.expiresAt >= :today)
           """)
    boolean existsValidByType(@Param("candidateId") Long candidateId,
                              @Param("type") DocumentType type,
                              @Param("today") LocalDate today);
}
