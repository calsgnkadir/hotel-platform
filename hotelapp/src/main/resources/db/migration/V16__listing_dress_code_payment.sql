-- V16 — İlan netliği: kıyafet/getirilecekler + ödeme periyodu/şekli/notu.
-- İdempotent (dev DB'de ddl-auto=update önceden eklemiş olabilir).

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'dress_code') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `dress_code` text NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'payment_period') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `payment_period` varchar(20) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'payment_method') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `payment_method` varchar(20) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'payment_note') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `payment_note` varchar(255) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
