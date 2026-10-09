-- V20 — Isletme adayi engeller (business_blocks'un ters yonu).
-- Engellenen aday isletmenin ilanlarina basvuramaz / isletmeyle eslesmez;
-- kurallar uygulama katmaninda (CandidateBlock entity + servis) uygulanir.
-- Bir isletme ayni adayi yalniz bir kez engeller (uk_business_candidate_block).
-- business_id unique anahtarin en solunda oldugu icin ayri indeks gerekmez;
-- "beni engelleyen isletmeler" sorgusu icin candidate_id'ye ayri indeks var.
-- Isletme ya da kullanici silinirse engel kaydi da silinir (ON DELETE CASCADE).
-- PK zorunlu (Aiven sql_require_primary_key=ON uyumu).

CREATE TABLE `candidate_blocks` (
    `id`            BIGINT        NOT NULL AUTO_INCREMENT,
    `business_id`   BIGINT        NOT NULL,
    `candidate_id`  BIGINT        NOT NULL,
    `created_at`    DATETIME(6)   NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_business_candidate_block` (`business_id`, `candidate_id`),
    KEY `idx_cb_candidate` (`candidate_id`),
    CONSTRAINT `fk_cb_business`  FOREIGN KEY (`business_id`)  REFERENCES `businesses` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_cb_candidate` FOREIGN KEY (`candidate_id`) REFERENCES `users` (`id`)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
