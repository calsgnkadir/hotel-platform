-- V17 — Toplu vardiya operasyonu: toplanma yeri + kaç dk önce toplanılacağı.
-- İdempotent (dev DB'de ddl-auto=update önceden eklemiş olabilir).

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'meeting_point') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `meeting_point` text NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'meeting_minutes_before') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `meeting_minutes_before` int NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
