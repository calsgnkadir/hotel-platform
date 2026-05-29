package com.hotelapp;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;

@SpringBootApplication
@EnableScheduling
public class HotelStudentPlatformApplication {

    public static void main(String[] args) {
        SpringApplication.run(HotelStudentPlatformApplication.class, args);
    }

    /**
     * JVM varsayılan timezone'unu İstanbul yap.
     * Railway sunucusu UTC çalışır; LocalDateTime.now() bu sayede İstanbul
     * saati üretir, frontend ile tutarlı olur (yanlış "X saat önce" düzelir).
     */
    @PostConstruct
    void setTimezone() {
        TimeZone.setDefault(TimeZone.getTimeZone("Europe/Istanbul"));
    }
}
