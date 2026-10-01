package com.hotelapp.security;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

/** Validate production settings before datasource creation or seed runners. */
@Configuration(proxyBeanMethods = false)
@Profile("prod")
public class ProductionSafetyConfiguration {
    @Bean
    static BeanFactoryPostProcessor productionEnvironmentCheck(Environment env) {
        return factory -> {
            if (env.acceptsProfiles(Profiles.of("dev", "demo", "test"))) {
                throw new IllegalStateException("PROD-SAFETY: prod cannot be combined with dev, demo or test. Use a separate demo environment and database.");
            }
            String username = env.getProperty("spring.datasource.username", "").trim();
            if (username.isEmpty() || "root".equalsIgnoreCase(username)) {
                throw new IllegalStateException("PROD-SAFETY: use a dedicated database user, not root (DB_USERNAME).");
            }
            if (!"validate".equals(env.getProperty("spring.jpa.hibernate.ddl-auto"))) {
                throw new IllegalStateException("PROD-SAFETY: production requires JPA_DDL_AUTO=validate; schema changes belong in Flyway.");
            }
        };
    }
}
