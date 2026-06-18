-- FAZ C.2 — Transactional Outbox pattern
--
-- Domain event'lerin at-least-once teslimi icin outbox tablosu.
-- Servis domain mutation ile birlikte ayni TX'inde outbox_events'e row yazar.
-- OutboxRelay scheduler (her 5 sn) pending row'lari okur ve handler'a yonlendirir.
-- processed_at IS NULL = pending, NOT NULL = teslim edildi.
-- attempts/last_error: hatali deneme sayisi + son hata mesaji (gozlem icin).

CREATE TABLE `outbox_events` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `event_type`   VARCHAR(64)  NOT NULL,
  `payload`      TEXT         NOT NULL,
  `created_at`   DATETIME(6)  NOT NULL,
  `processed_at` DATETIME(6)  NULL,
  `attempts`     INT          NOT NULL DEFAULT 0,
  `last_error`   VARCHAR(500) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_outbox_pending` (`processed_at`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
