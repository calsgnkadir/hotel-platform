-- V26 — Outbox ustel bekleme (outbox_events).
--  * next_attempt_at : basarisiz denemeden sonra relay'in bu satiri tekrar alabilecegi
--                      en erken an. NULL = hemen alinabilir (yeni satir / admin retry).
--                      Bekleme: 30 sn * 2^(deneme-1), ust sinir 1 saat (OutboxRelay).
--                      Devre kesici acikken deneme sayilmaz, yalniz bu alan ileri alinir.
--  * idx_outbox_due  : relay sorgusu (processed_at IS NULL AND next_attempt_at <= now).
--  * MAX_ATTEMPTS 5 -> 10: daha once DLQ'ya dusmus (attempts 5..9) satirlar yukseltme
--    sonrasi kendiliginden yeniden gonderilmesin (eski sifre sifirlama linki vb.) diye
--    10'a cekilir; admin panelinden "yeniden dene" ile yine elle gonderilebilir.
-- Idempotent (dev DB'de ddl-auto=update kolonu/indeksi once eklemis olabilir) — V21 deseni.

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'outbox_events' AND column_name = 'next_attempt_at') = 0,
  'ALTER TABLE `outbox_events` ADD COLUMN `next_attempt_at` datetime(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE()
  AND table_name = 'outbox_events' AND index_name = 'idx_outbox_due') = 0,
  'CREATE INDEX `idx_outbox_due` ON `outbox_events` (`processed_at`, `next_attempt_at`)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

UPDATE `outbox_events` SET `attempts` = 10
 WHERE `processed_at` IS NULL AND `attempts` >= 5 AND `attempts` < 10;
