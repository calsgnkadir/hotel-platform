package com.hotelapp.service;

import com.hotelapp.entity.Document;
import com.hotelapp.enums.DocumentType;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.event.AuditLoggedEvent;
import com.hotelapp.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Belge son-kullanma hatırlatıcısı.
 *
 * <p>Hijyen/sağlık, adli sicil gibi süreli belgeler dolmadan aday uyarılır — böylece
 * işletme "belgesi geçerli" filtresinde adayı kaçırmaz, aday da fırsatı kaybetmez.
 *
 * <p>Idempotency: her belge için tek hatırlatma — {@code expiryReminderSentAt} set edilir,
 * tekrar gönderilmez. Aday belgeyi yenileyip yeniden yüklediğinde yeni kayıt oluşur ve
 * damga sıfırlanır, böylece bir sonraki dönem için yine hatırlatılır.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentExpiryReminderService {

    private final DocumentRepository documentRepository;
    private final NotificationService notificationService;
    private final OutboxService outboxService;

    /** Son kullanmaya bu kadar gün kala hatırlat. */
    @Value("${app.documents.expiry-reminder-days:14}")
    private int reminderDays;

    /**
     * Son kullanma tarihi yaklaşan (veya geçmiş ama hiç hatırlatılmamış) belgeler için
     * adaya tek seferlik hatırlatma gönderir.
     *
     * @return gönderilen hatırlatma sayısı
     */
    @Transactional
    public int sendDueReminders() {
        LocalDate threshold = LocalDate.now().plusDays(reminderDays);
        List<Document> due = documentRepository.findExpiringNeedingReminder(threshold);
        if (due.isEmpty()) return 0;

        int sent = 0;
        for (Document doc : due) {
            try {
                notifyOwner(doc);
                doc.setExpiryReminderSentAt(LocalDateTime.now());
                documentRepository.save(doc);
                sent++;
            } catch (Exception ex) {
                log.warn("[DOC-EXPIRY] hatirlatma basarisiz doc={}: {}", doc.getId(), ex.getMessage());
            }
        }
        log.info("[DOC-EXPIRY] {} adaya belge son-kullanma hatirlatmasi gonderildi", sent);
        return sent;
    }

    private void notifyOwner(Document doc) {
        Long candidateId = doc.getStudent().getId();
        String label = typeLabel(doc.getType());
        LocalDate exp = doc.getExpiresAt();
        long days = ChronoUnit.DAYS.between(LocalDate.now(), exp);

        String title;
        String message;
        if (days < 0) {
            title = label + " süresi doldu";
            message = label + " belgenin süresi doldu. Yenileyip tekrar yükle — "
                    + "geçerli belgesi olan adaylar işletmeler tarafından öne çıkarılır.";
        } else {
            title = label + " son kullanma yaklaşıyor";
            message = label + " belgenin son kullanma tarihine " + days + " gün kaldı ("
                    + exp.getDayOfMonth() + "." + exp.getMonthValue() + "." + exp.getYear() + "). "
                    + "Süresi dolmadan yenileyip yükle.";
        }

        notificationService.notify(candidateId, NotificationType.DOCUMENT_EXPIRING,
                title, message, "documents");

        outboxService.appendAuditLog(AuditLoggedEvent.system(
                "DOCUMENT_EXPIRY_REMINDER_SENT", "DOCUMENT", doc.getId(),
                "Aday=" + candidateId + " için " + label + " son-kullanma hatırlatması gönderildi."));
    }

    private static String typeLabel(DocumentType type) {
        return switch (type) {
            case HEALTH_CERTIFICATE -> "Hijyen / Sağlık";
            case CRIMINAL_RECORD    -> "Adli sicil";
            case IDENTITY_DOCUMENT  -> "Kimlik";
            case STUDENT_CERTIFICATE -> "Öğrenci belgesi";
            case TRANSCRIPT         -> "Transkript";
            case CV                 -> "CV";
        };
    }
}
