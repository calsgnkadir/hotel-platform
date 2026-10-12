-- V25 — Vardiya bazinda "gelmedi" (no-show) isaretleri.
-- Isletme cok vardiyali bir basvuruda adayi yalniz ilgili vardiya icin
-- "bu vardiyada gelmedi" olarak isaretler; her isaret bir satirdir.
--  * uk_anss_application_slot : ayni basvuru + vardiya iki kez isaretlenemez
--                               (cift ceza / cift koltuk bosaltma DB seviyesinde
--                               de engellenir). application_id unique anahtarin
--                               en solunda oldugu icin ayri indeks gerekmez.
--  * idx_anss_slot            : vardiyaya gore yoklama/ekip listesi sorgusu.
-- Basvuru ya da vardiya silinirse isaret de silinir (ON DELETE CASCADE).
-- Gecmis veri doldurma (backfill) YOK: applications.no_show=1 olup bu tabloda
-- satiri olmayan eski kayitlar backend'de eski davranisla yorumlanir.
-- PK zorunlu (Aiven sql_require_primary_key=ON uyumu).
-- Idempotent: CREATE TABLE IF NOT EXISTS (dev DB'de ddl-auto=update tabloyu
-- once olusturmus olabilir).

CREATE TABLE IF NOT EXISTS `application_no_show_slots` (
    `id`              BIGINT        NOT NULL AUTO_INCREMENT,
    `application_id`  BIGINT        NOT NULL,
    `shift_slot_id`   BIGINT        NOT NULL,
    `marked_at`       DATETIME(6)   NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_anss_application_slot` (`application_id`, `shift_slot_id`),
    KEY `idx_anss_slot` (`shift_slot_id`),
    CONSTRAINT `fk_anss_application` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_anss_slot`        FOREIGN KEY (`shift_slot_id`)  REFERENCES `shift_slots` (`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
