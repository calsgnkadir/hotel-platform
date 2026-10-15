package com.hotelapp.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Prod profili: Swagger varsayılan kapalı, /actuator/info JVM/OS ayrıntısı vermez. */
class ProdHardeningConfigTest {

    private static PropertySource<?> prodYaml() throws Exception {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader()
                .load("prod", new ClassPathResource("application-prod.yml"));
        assertThat(sources).hasSize(1);
        return sources.get(0);
    }

    @Test
    void swaggerDisabledByDefaultInProd() throws Exception {
        PropertySource<?> prod = prodYaml();
        assertThat(String.valueOf(prod.getProperty("springdoc.api-docs.enabled"))).isEqualTo("${SWAGGER_ENABLED:false}");
        assertThat(String.valueOf(prod.getProperty("springdoc.swagger-ui.enabled"))).isEqualTo("${SWAGGER_ENABLED:false}");
    }

    @Test
    void actuatorInfoHidesJavaAndOsInProd() throws Exception {
        PropertySource<?> prod = prodYaml();
        assertThat(String.valueOf(prod.getProperty("management.info.java.enabled"))).isEqualTo("false");
        assertThat(String.valueOf(prod.getProperty("management.info.os.enabled"))).isEqualTo("false");
        assertThat(prod.getProperty("info.java.version")).isNull();
    }

    @Test
    void swaggerPathsPublicOnlyWhenEnabled() {
        assertThat(SecurityConfig.docPaths(true, true))
                .containsExactlyInAnyOrder("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html");
        assertThat(SecurityConfig.docPaths(false, false))
                .doesNotContain("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                .hasSize(1);
        assertThat(SecurityConfig.docPaths(true, false)).containsExactly("/v3/api-docs/**");
    }
}
