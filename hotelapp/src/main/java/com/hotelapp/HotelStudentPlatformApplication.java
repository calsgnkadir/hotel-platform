package com.hotelapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class HotelStudentPlatformApplication {

    public static void main(String[] args) {
        SpringApplication.run(HotelStudentPlatformApplication.class, args);
    }

}
