-- V21 — Ilan moderasyonu ve acil bildirim frenleri (job_listings).
--  * admin_suspended    : admin ilani askiya aldi (PAUSED/CLOSED). Isletme bu ilani
--                         ACTIVE yapamaz; yalniz admin ACTIVE yapinca bayrak kalkar.
--                         Mevcut ilanlar icin varsayilan 0 (askida degil).
--  * urgent_notified_at : son "hemen musait" havuzu toplu bildirimi. Ayni ilan icin
--                         bekleme suresi dolmadan acil kapat-ac dongusu yeni toplu
--                         bildirim uretmez (UrgentService). NULL = hic bildirilmedi.
-- Idempotent (dev DB'de ddl-auto=update kolonu once eklemis olabilir) — V17 deseni.

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'admin_suspended') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `admin_suspended` bit(1) NOT NULL DEFAULT 0', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'urgent_notified_at') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `urgent_notified_at` datetime(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
