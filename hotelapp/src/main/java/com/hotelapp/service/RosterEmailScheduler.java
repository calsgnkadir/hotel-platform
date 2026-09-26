package com.hotelapp.service;

import com.hotelapp.entity.JobListing;
import com.hotelapp.enums.NotificationType;
import com.hotelapp.repository.JobListingRepository;
import com.hotelapp.repository.ShiftSlotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * Her akşam 20:00 (İstanbul): o gün vardiyası olan her ilan için ekip listesi
 * (.xlsx) işletme sahibine e-postayla gider + panelde bildirim düşer.
 * O gün kabul edilmiş kimse yoksa hiçbir şey gönderilmez.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RosterEmailScheduler {

    private static final ZoneId TR = ZoneId.of("Europe/Istanbul");
    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private final ShiftSlotRepository shiftSlotRepository;
    private final JobListingRepository jobListingRepository;
    private final RosterService rosterService;
    private final EmailService emailService;
    private final EmailTemplates emailTemplates;
    private final NotificationService notificationService;

    @Value("${app.base-url:http://localhost:5173}")
    private String baseUrl;

    @Scheduled(cron = "0 0 20 * * *", zone = "Europe/Istanbul")
    public void sendTodaysRosters() {
        sendRostersFor(LocalDate.now(TR));
    }

    /** Test/yeniden gönderim için tarihli sürüm. */
    public int sendRostersFor(LocalDate date) {
        int sent = 0;
        for (Long listingId : shiftSlotRepository.findListingIdsWithSlotOn(date)) {
            try {
                byte[] xlsx = rosterService.xlsxForDateOrNull(listingId, date);
                if (xlsx == null) continue;
                JobListing l = jobListingRepository.findById(listingId).orElse(null);
                if (l == null) continue;
                var owner = l.getBusiness().getOwner();
                String html = emailTemplates.rosterReady(owner.getFullName(), l.getTitle(), D.format(date),
                        Math.max(1, xlsx.length / 1024), baseUrl + "/business?tab=listings");
                emailService.sendWithAttachment(owner.getEmail(),
                        "Ekip listesi · " + l.getTitle() + " · " + D.format(date), html,
                        "kadrom-ekip-" + listingId + "-" + date + ".xlsx", xlsx);
                notificationService.notify(owner.getId(), NotificationType.GENERIC,
                        "Ekip listesi hazır",
                        "\"" + l.getTitle() + "\" · " + D.format(date) + " listesi e-postana gönderildi",
                        "listings");
                sent++;
            } catch (Exception e) {
                // Bir ilanın hatası diğerlerini durdurmasın
                log.warn("[ROSTER] ilan={} tarih={} gönderilemedi: {}", listingId, date, e.getMessage());
            }
        }
        if (sent > 0) log.info("[ROSTER] {} için {} ekip listesi gönderildi", date, sent);
        return sent;
    }
}
