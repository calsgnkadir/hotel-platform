package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExpiredApplicationScheduler {

    /** İş kuralı saati: Türkiye yerel saati, JVM saat diliminden bağımsız (testte sabitlenebilir). */
    java.time.Clock clock = java.time.Clock.system(java.time.ZoneId.of("Europe/Istanbul"));

    private final ApplicationRepository applicationRepository;
    private final StandbyService standbyService;   // FAZ C.1
    private final SgkReminderService sgkReminderService;   // FAZ C.3

    /**
     * Kayit basina transaction (REQUIRES_NEW): bir basvurudaki @Version cakismasi (ayni anda
     * kabul/geri cekme) yalniz o kaydi geri alir, partinin geri kalani islenir. Spring
     * baglaminda kurulur; baglam disi birim testlerinde transaction'siz calisir (GdprService deseni).
     */
    private org.springframework.transaction.support.TransactionOperations perRecordTx =
            org.springframework.transaction.support.TransactionOperations.withoutTransaction();

    @org.springframework.beans.factory.annotation.Autowired
    void setTransactionManager(org.springframework.transaction.PlatformTransactionManager txManager) {
        org.springframework.transaction.support.TransactionTemplate t =
                new org.springframework.transaction.support.TransactionTemplate(txManager);
        t.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.perRecordTx = t;
    }

    // Her gece 02:00'de (Türkiye saati) çalışır
    @Scheduled(cron = "${app.scheduling.expire-applications-cron:0 0 2 * * *}", zone = "Europe/Istanbul")
    public void markExpiredApplications() {
        LocalDateTime now = LocalDateTime.now(clock);
        List<Long> ids = applicationRepository.findExpiredApplications(now).stream()
                .map(Application::getId).toList();
        int done = expireEach(ids, "PENDING",
                app -> app.getStatus() == ApplicationStatus.PENDING
                        && app.getDeadline() != null && app.getDeadline().isBefore(now));
        log.info("Toplam {} / {} başvuru EXPIRED olarak işaretlendi.", done, ids.size());
    }

    // FAZ 2/#28 — Her 5 dakikada bir suresi gecmis HOLD basvurularini EXPIRED yap
    @Scheduled(fixedDelayString = "${app.scheduling.hold-expiry-delay-ms:300000}",
               initialDelayString = "${app.scheduling.hold-expiry-initial-delay-ms:0}")
    public void expireOverdueHolds() {
        LocalDateTime now = LocalDateTime.now(clock);
        List<Long> ids = applicationRepository
                .findByStatusAndHoldDeadlineBefore(ApplicationStatus.HELD, now).stream()
                .map(Application::getId).toList();
        if (ids.isEmpty()) return;
        expireEach(ids, "HOLD",
                app -> app.getStatus() == ApplicationStatus.HELD
                        && app.getHoldDeadline() != null && app.getHoldDeadline().isBefore(now));
    }

    /**
     * Her kaydi kendi transaction'inda taze okur, kosul hala gecerliyse EXPIRED yapar.
     * Arada baska bir islem (kabul, geri cekme) durumu degistirdiyse dokunmaz; @Version
     * cakismasi ya da baska hata yalniz o kaydi atlar ve loglanir (sonraki calismada tekrar denenir).
     */
    int expireEach(List<Long> ids, String kind, java.util.function.Predicate<Application> stillDue) {
        int done = 0, failed = 0;
        for (Long id : ids) {
            try {
                Boolean changed = perRecordTx.execute(st -> {
                    Application app = applicationRepository.findById(id).orElse(null);
                    if (app == null || !stillDue.test(app)) return false;
                    app.setStatus(ApplicationStatus.EXPIRED);
                    applicationRepository.saveAndFlush(app);
                    return true;
                });
                if (Boolean.TRUE.equals(changed)) {
                    done++;
                    log.info("{} başvuru süresi doldu, EXPIRED yapıldı. ID: {}", kind, id);
                }
            } catch (RuntimeException ex) {
                failed++;
                log.warn("{} başvuru {} EXPIRED yapılamadı (sonraki çalışmada tekrar denenecek): {}",
                        kind, id, ex.toString());
            }
        }
        if (failed > 0) log.warn("{} süre dolumu: {} / {} kayıt işlenemedi", kind, failed, ids.size());
        return done;
    }

    /**
     * FAZ C.1 — Suresi gecmis yedek tekliflerini kapat, siradaki yedege gec.
     * Acil akis oldugu icin HOLD ile ayni sikligi (5 dk) kullanir.
     */
    @Scheduled(fixedDelayString = "${app.scheduling.standby-expiry-delay-ms:300000}",
               initialDelayString = "${app.scheduling.standby-expiry-initial-delay-ms:0}")
    public void expireOverdueStandbyOffers() {
        try {
            int n = standbyService.expireOverdueOffers();
            if (n > 0) log.info("[STANDBY] {} yedek teklifinin suresi doldu, siradakine gecildi", n);
        } catch (Exception e) {
            log.warn("[STANDBY] teklif suresi temizligi basarisiz: {}", e.getMessage());
        }
    }

    /**
     * FAZ C.3 — SGK ise giris bildirgesi hatirlaticisi.
     * Her sabah 09:00: vardiyasi bugun/yarin olan kabul edilmis basvurular icin
     * isletmeye tek sefer hatirlatma. Sabah calisir cunku isveren gun icinde
     * bildirgeyi verecek zamana sahip olsun.
     */
    @Scheduled(cron = "${app.scheduling.sgk-reminder-cron:0 0 9 * * *}", zone = "Europe/Istanbul")
    public void sendSgkReminders() {
        try {
            int n = sgkReminderService.sendDueReminders();
            if (n > 0) log.info("[SGK] {} isletmeye ise giris bildirgesi hatirlatmasi gonderildi", n);
        } catch (Exception e) {
            log.warn("[SGK] hatirlatma gonderimi basarisiz: {}", e.getMessage());
        }
    }
}
