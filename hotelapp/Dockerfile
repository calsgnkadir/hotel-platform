# ── Build stage: Maven + JDK 17 → fat jar ──────────────────────────
# mvnw repoda bozuk; imajın kendi mvn'i kullanılıyor.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Önce sadece pom → bağımlılık katmanı cache'lenir (src değişince yeniden inmez)
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline

COPY src ./src
# Testler CI'da (ci.yml) çalışıyor; imaj build'inde atlanır → hızlı imaj.
RUN mvn -B -ntp clean package -DskipTests

# ── Runtime stage: sadece JRE + jar (küçük imaj) ───────────────────
FROM eclipse-temurin:17-jre
WORKDIR /app

# Non-root çalıştır (güvenlik)
RUN useradd -r -u 1001 appuser
COPY --from=build /app/target/*.jar app.jar
USER appuser

EXPOSE 8080
# Docker'da profil: default (Flyway açık, MySQL'e bağlanır — compose sağlar)
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
