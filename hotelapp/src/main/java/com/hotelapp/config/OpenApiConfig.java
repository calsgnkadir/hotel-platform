package com.hotelapp.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Contact;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
    info = @Info(
        title       = "AjansHotel API",
        version     = "2.0",
        description = """
            İstanbul'un otel iş platformu — adayları ve işletmeleri buluşturur.

            **Roller:**
            - `CANDIDATE`      — ilanlara başvurur, belge yükler
            - `BUSINESS_OWNER` — ilan oluşturur, başvuruları inceler
            - `ADMIN`          — platform yönetimi (Faz D)

            **Auth:** Sağ üstteki "Authorize" butonuna Bearer token yapıştır.
            Token formatı: `Bearer eyJhbGci...`
            """,
        contact = @Contact(name = "Platform Ekibi")
    ),
    servers = {
        @Server(url = "http://localhost:8080", description = "Geliştirme"),
        @Server(url = "https://api.hotelplatform.com", description = "Prodüksiyon")
    }
)
@SecurityScheme(
    name         = "bearerAuth",
    type         = SecuritySchemeType.HTTP,
    scheme       = "bearer",
    bearerFormat = "JWT",
    in           = SecuritySchemeIn.HEADER,
    description  = "/api/auth/login'den aldığın token'ı buraya yapıştır"
)
public class OpenApiConfig {
    // Annotation tabanlı konfigürasyon — bean tanımlamaya gerek yok
}
