-- FAZ I.5 — Destek/Feedback bileti tablosu

CREATE TABLE `support_tickets` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT,
    `user_id`     BIGINT       NOT NULL,
    `subject`     VARCHAR(32)  NOT NULL,
    `message`     TEXT         NOT NULL,
    `status`      VARCHAR(16)  NOT NULL DEFAULT 'OPEN',
    `admin_note`  TEXT,
    `created_at`  DATETIME(6)  NOT NULL,
    `resolved_at` DATETIME(6),
    PRIMARY KEY (`id`),
    KEY `idx_support_user_created` (`user_id`, `created_at`),
    KEY `idx_support_status`       (`status`),
    CONSTRAINT `fk_support_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
