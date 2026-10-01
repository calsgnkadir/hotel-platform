package com.hotelapp.security;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.DependsOn;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Removing the demo profile does not remove accounts seeded in an old database.
 * Vitrin (prod,showcase) bilerek demo hesaplarla çalışır; orada bu kontrol kapalı.
 */
@Component
@Profile("prod & !showcase")
@Lazy(false)
@DependsOn("entityManagerFactory")
@RequiredArgsConstructor
public class ProductionDemoDataGuard {
    private final JdbcTemplate jdbc;

    @PostConstruct
    void verifyNoDemoAccounts() {
        Long count = jdbc.queryForObject("""
                SELECT COUNT(*) FROM users
                WHERE LOWER(email) LIKE 'demo-aday%@test.com'
                   OR LOWER(email) LIKE 'demo-isletme%@test.com'
                """, Long.class);
        if (count == null || count > 0) {
            throw new IllegalStateException("PROD-SAFETY: demo accounts found. Use a separate production database or review and migrate existing data. No records were deleted.");
        }
    }
}
