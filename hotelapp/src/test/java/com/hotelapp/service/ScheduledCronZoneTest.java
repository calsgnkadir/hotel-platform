package com.hotelapp.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.scheduling.annotation.Scheduled;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cron'lu tüm @Scheduled işler Türkiye saatiyle çalışır: sunucu/JVM UTC olsa da
 * "her gece 02:00" İstanbul'da 02:00'dir (iş kuralı saatleriyle tutarlı).
 */
class ScheduledCronZoneTest {

    @Test
    void everyCronJobDeclaresIstanbulZone() throws Exception {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter((reader, factory) -> true);
        List<String> cronJobs = new ArrayList<>();
        List<String> missingZone = new ArrayList<>();
        ClassLoader cl = getClass().getClassLoader();
        for (BeanDefinition bd : scanner.findCandidateComponents("com.hotelapp")) {
            Class<?> type = Class.forName(bd.getBeanClassName(), false, cl);
            for (Method m : type.getDeclaredMethods()) {
                Scheduled s = m.getAnnotation(Scheduled.class);
                if (s == null || s.cron().isEmpty()) continue;
                String name = type.getSimpleName() + "." + m.getName();
                cronJobs.add(name);
                if (!"Europe/Istanbul".equals(s.zone())) missingZone.add(name);
            }
        }
        assertThat(cronJobs).contains(
                "ExpiredApplicationScheduler.markExpiredApplications",
                "ExpiredApplicationScheduler.sendSgkReminders",
                "GdprService.anonymizeDueAccounts",
                "OutboxRelay.cleanupProcessed",
                "RefreshTokenService.cleanup",
                "RosterEmailScheduler.sendTodaysRosters");
        assertThat(missingZone).as("zone = \"Europe/Istanbul\" eksik cron işleri").isEmpty();
    }
}
