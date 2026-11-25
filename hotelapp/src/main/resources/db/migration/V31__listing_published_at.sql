-- V31 — Ilan yayin ani (job_listings.published_at).
--  * published_at : ilanin son yayina alinma ani. Ilan ACTIVE olusturuldugunda ve
--                   ACTIVE olmayan durumdan ACTIVE'e her geciste atanir (onceki yayin
--                   24 saatten yeniyse ilerlemez — JobListing.REPUBLISH_COOLDOWN).
--                   Kayitli arama taramasi COALESCE(published_at, created_at) penceresine
--                   bakar; durdurulup yeniden yayina alinan ilan kacmaz.
--                   created_at ile ayni tip: datetime(6) NULL.
--  * Backfill     : mevcut satirlarda published_at = created_at (yalniz NULL olanlar).
--  * Indeks       : (status, published_at) — ACTIVE + yayin ani taramasi.
-- Idempotent (dev DB'de ddl-auto=update kolonu/indeksi once eklemis olabilir) — V21/V24 deseni.

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'published_at') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `published_at` datetime(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

UPDATE `job_listings` SET `published_at` = `created_at` WHERE `published_at` IS NULL;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND index_name = 'idx_listing_status_published') = 0,
  'CREATE INDEX `idx_listing_status_published` ON `job_listings` (`status`, `published_at`)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
