package com.hotelapp.service;

import com.hotelapp.entity.Application;
import com.hotelapp.enums.ApplicationStatus;
import com.hotelapp.repository.ApplicationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExpiredApplicationScheduler {

    private final ApplicationRepository applicationRepository;

    // Her gece 02:00'de çalışır
    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void markExpiredApplications() {
        List<Application> expired = applicationRepository.findExpiredApplications(LocalDateTime.now());

        expired.forEach(app -> {
            app.setStatus(ApplicationStatus.EXPIRED);
            log.info("Başvuru süresi doldu, EXPIRED yapıldı. ID: {}", app.getId());
        });

        applicationRepository.saveAll(expired);
        log.info("Toplam {} başvuru EXPIRED olarak işaretlendi.", expired.size());
    }

    // FAZ 2/#28 — Her 5 dakikada bir suresi gecmis HOLD basvurularini EXPIRED yap
    @Scheduled(fixedDelay = 5 * 60 * 1000)
    @Transactional
    public void expireOverdueHolds() {
        LocalDateTime now = LocalDateTime.now();
        List<Application> overdue = applicationRepository
                .findByStatusAndHoldDeadlineBefore(ApplicationStatus.HELD, now);
        if (overdue.isEmpty()) return;
        overdue.forEach(app -> {
            app.setStatus(ApplicationStatus.EXPIRED);
            log.info("HOLD süresi doldu, EXPIRED. ID: {}", app.getId());
        });
        applicationRepository.saveAll(overdue);
    }
}
