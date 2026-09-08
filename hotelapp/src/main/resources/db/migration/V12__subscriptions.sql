-- Faz 1 — Isletme aboneligi (iyzico ile satislabilir MVP).
-- Isci tarafi HER ZAMAN ucretsiz; gelir yalniz isletme tarafinda.
-- Zorlama (enforce) app.billing.enforce ile kapali gelir; acilinca ilan acmak
-- aktif deneme/abonelik ister. iyzico SANDBOX (gercek para yok) — canliya
-- gecis yalniz env key + ticari/yasal onay ile.

CREATE TABLE `subscriptions` (
    `id`                    BIGINT        NOT NULL AUTO_INCREMENT,
    `business_id`           BIGINT        NOT NULL,
    `status`                VARCHAR(20)   NOT NULL,
    `plan`                  VARCHAR(40)   NOT NULL,
    `trial_ends_at`         DATETIME(6),
    `current_period_end`    DATETIME(6),
    `last_checkout_token`   VARCHAR(255),
    `last_payment_id`       VARCHAR(64),
    `created_at`            DATETIME(6)   NOT NULL,
    `updated_at`            DATETIME(6)   NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_sub_business` (`business_id`),
    KEY `idx_sub_status_period` (`status`, `current_period_end`),
    CONSTRAINT `fk_sub_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
