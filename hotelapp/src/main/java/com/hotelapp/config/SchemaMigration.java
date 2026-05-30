package com.hotelapp.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotent şema migrasyonu — ddl-auto: update'in yapmadığı işleri yapar.
 *
 * <p>Hibernate'in update modu mevcut MySQL ENUM kolonlarına yeni değer eklemez.
 * Yeni enum değerleri (örn. NotificationType.MATCHING_LISTING, Status.WITHDRAWN)
 * eklendiğinde "Data truncated for column" hatası alınır.
 *
 * <p>Bu sınıf her startup'ta ilgili ENUM kolonları VARCHAR'a çevirir.
 * MODIFY COLUMN aynı tipe çalıştırılırsa MySQL no-op kabul eder, hata vermez.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Order(1)
public class SchemaMigration implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        migrate("notifications", "type",         "VARCHAR(40) NOT NULL");
        migrate("applications",  "status",       "VARCHAR(20) NOT NULL");
        migrate("notifications", "title",        "VARCHAR(150) NOT NULL");
        // İhtiyaç olunca eklenir.
    }

    private void migrate(String table, String column, String newType) {
        try {
            jdbcTemplate.execute(
                "ALTER TABLE " + table + " MODIFY COLUMN " + column + " " + newType
            );
            log.info("[MIGRATION] {}.{} -> {}", table, column, newType);
        } catch (Exception e) {
            // Tablo yoksa (ilk deploy) veya zaten doğru tip ise sessiz geç
            log.warn("[MIGRATION] {}.{} migrate atlandı: {}", table, column, e.getMessage());
        }
    }
}
