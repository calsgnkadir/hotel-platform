-- V23 — Odeme checkout kayitlari (abonelik odemesi baslatma/sonuclandirma).
--  * token           : odeme saglayicisinin checkout token'i; tekil
--                      (uk_payment_checkouts_token) — ayni callback iki kez
--                      islenmez.
--  * conversation_id : saglayiciya gonderilen istek/konusma kimligi.
--  * status          : PENDING / SUCCEEDED / FAILED / EXPIRED (JPA EnumType.STRING).
--  * expected_price  : checkout baslatilirken beklenen tutar; paid_price
--                      saglayicinin bildirdigi odenen tutar (tamamlaninca dolar).
--  * idx_payment_checkouts_status_created : suresi dolan PENDING kayitlarini
--                      tarayan zamanlayici icin (status = ? AND created_at < ?).
-- business_id FK'si InnoDB tarafindan ayrica indekslenir (fk adiyla).
-- Isletme silinirse checkout kayitlari da silinir (ON DELETE CASCADE).
-- PK zorunlu (Aiven sql_require_primary_key=ON uyumu).
-- Idempotent: CREATE TABLE IF NOT EXISTS (dev DB'de ddl-auto=update tabloyu
-- once olusturmus olabilir).

CREATE TABLE IF NOT EXISTS `payment_checkouts` (
    `id`               BIGINT         NOT NULL AUTO_INCREMENT,
    `business_id`      BIGINT         NOT NULL,
    `token`            VARCHAR(255)   NOT NULL,
    `conversation_id`  VARCHAR(64)    NOT NULL,
    `status`           VARCHAR(16)    NOT NULL,
    `expected_price`   DECIMAL(10,2)  NOT NULL,
    `paid_price`       DECIMAL(10,2)  NULL,
    `created_at`       DATETIME(6)    NOT NULL,
    `completed_at`     DATETIME(6)    NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_payment_checkouts_token` (`token`),
    KEY `idx_payment_checkouts_status_created` (`status`, `created_at`),
    CONSTRAINT `fk_payment_checkouts_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
