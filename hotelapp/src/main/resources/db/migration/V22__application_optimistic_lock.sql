-- V22 — applications icin iyimser kilit (JPA @Version).
--  * version : her guncellemede Hibernate tarafindan artirilir; ayni basvuruyu
--              es zamanli guncelleyen ikinci islem OptimisticLockException alir
--              (kabul/red/yedek teklifi yarislari).
--              Mevcut satirlar icin varsayilan 0.
-- Idempotent:
--  * Kolon yoksa eklenir (MySQL 8.0.12+ ALGORITHM=INSTANT; tablo kopyalanmaz).
--  * Kolon zaten varsa (eski prod semasinda kalan `version` — bkz. V4 — ya da dev
--    DB'de ddl-auto=update ile eklenmis olabilir) NULL degerler 0'a cekilir ve
--    tanim yalniz farkliysa BIGINT NOT NULL DEFAULT 0'a getirilir.

-- 1) Kolon yoksa ekle.
SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'applications' AND column_name = 'version') = 0,
  'ALTER TABLE `applications` ADD COLUMN `version` BIGINT NOT NULL DEFAULT 0', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 2) Kolon onceden nullable olarak varsa NULL'lari 0 yap (yalniz NULL satirlar).
SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'applications' AND column_name = 'version' AND is_nullable = 'YES') = 1,
  'UPDATE `applications` SET `version` = 0 WHERE `version` IS NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 3) Tanim beklenenden farkliysa duzelt (zaten dogruysa tablo yeniden yazilmaz).
SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'applications' AND column_name = 'version'
  AND NOT (data_type = 'bigint' AND is_nullable = 'NO' AND column_default = '0')) = 1,
  'ALTER TABLE `applications` MODIFY COLUMN `version` BIGINT NOT NULL DEFAULT 0', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
