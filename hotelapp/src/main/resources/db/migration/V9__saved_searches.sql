-- FAZ 5 — Saved Searches (Kayıtlı Aramalar + Yeni Eşleşme Bildirimleri)

CREATE TABLE `saved_searches` (
    `id`                    BIGINT        NOT NULL AUTO_INCREMENT,
    `user_id`               BIGINT        NOT NULL,
    `name`                  VARCHAR(100)  NOT NULL,
    `position`              VARCHAR(32),
    `job_type`              VARCHAR(32),
    `district`              VARCHAR(64),
    `keyword`               VARCHAR(255),
    `min_salary`            DECIMAL(12, 2),
    `date_from`             DATE,
    `date_to`               DATE,
    `notifications_enabled` BOOLEAN       NOT NULL DEFAULT TRUE,
    `last_notified_at`      DATETIME(6),
    `created_at`            DATETIME(6)   NOT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_saved_user`            (`user_id`),
    KEY `idx_saved_notif_scan`      (`notifications_enabled`, `last_notified_at`),
    CONSTRAINT `fk_saved_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `saved_search_shifts` (
    `saved_search_id` BIGINT      NOT NULL,
    `shift`           VARCHAR(16) NOT NULL,
    KEY `idx_sss_search` (`saved_search_id`),
    CONSTRAINT `fk_sss_search` FOREIGN KEY (`saved_search_id`) REFERENCES `saved_searches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
