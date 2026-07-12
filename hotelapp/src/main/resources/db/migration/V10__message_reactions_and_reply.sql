-- FAZ 11 Wave 3 — Mesaj reaksiyonlari + quoted reply

-- Quoted reply: mesaj baska bir mesaja yanit olabilir.
-- Parent silinirse yanit ayakta kalir (SET NULL) — WhatsApp davranisi.
ALTER TABLE `messages`
    ADD COLUMN `parent_message_id` BIGINT NULL,
    ADD KEY `idx_msg_parent` (`parent_message_id`),
    ADD CONSTRAINT `fk_msg_parent` FOREIGN KEY (`parent_message_id`)
        REFERENCES `messages` (`id`) ON DELETE SET NULL;

-- Reaksiyonlar: kullanici basina mesaj basina 1 reaksiyon (WhatsApp modeli).
-- Ayni reaksiyona tekrar basmak kaldirir, farkli reaksiyon eskisini degistirir.
CREATE TABLE `message_reactions` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT,
    `message_id`  BIGINT       NOT NULL,
    `user_id`     BIGINT       NOT NULL,
    `reaction`    VARCHAR(20)  NOT NULL,
    `created_at`  DATETIME(6)  NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_reaction_msg_user` (`message_id`, `user_id`),
    KEY `idx_reaction_msg` (`message_id`),
    CONSTRAINT `fk_reaction_msg`  FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_reaction_user` FOREIGN KEY (`user_id`)    REFERENCES `users` (`id`)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_turkish_ci;
