package com.hotelapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class HotelStudentPlatformApplication {

    /**
     * JVM varsayılan timezone'unu İstanbul yap.
     * KRİTİK: Spring (ve Hibernate) başlatılmadan ÖNCE set edilmeli;
     * @PostConstruct çok geç çalışır ve Hibernate'in JDBC katmanı
     * UTC üzerinden LocalDate'i 1 gün geri kaydırır.
     * Railway sunucusu UTC çalışır.
     */
    public static void main(String[] args) {
        TimeZone.setDefault(TimeZone.getTimeZone("Europe/Istanbul"));
        System.setProperty("user.timezone", "Europe/Istanbul");
        SpringApplication.run(HotelStudentPlatformApplication.class, args);
    }
}
