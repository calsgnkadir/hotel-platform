-- FAZ 4.7 fix — idempotent hale getirildi.
--
-- ORIJINAL AMAC: applications/job_listings/shift_slots tablolarinda,
-- Hibernate'in eski bir @Version denemesinden kalan `version` sutununa
-- DEFAULT 0 koymak. Boylece Hibernate INSERT'e version yazmasa bile
-- MySQL default atiyordu.
--
-- NEDEN DEGISTI: O `version` sutunu yalnizca eski production semasinda
-- vardi. V1 baseline bu uc tabloyu version sutunu OLMADAN olusturuyor ve
-- artik hicbir entity'de @Version yok. Sonuc: TEMIZ bir veritabaninda V4
-- "Unknown column 'version' in 'applications'" ile patliyor, uygulama hic
-- ayaga kalkmiyordu (Docker'da ve her yeni ortamda ayni hata).
--
-- COZUM: MODIFY yalnizca sutun gercekten varsa calissin. Temiz kurulumda
-- sessizce atlanir; eski semada eskisi gibi yamayi uygular.
--
-- DIKKAT: Bu dosyanin checksum'i degisti. V4'u daha once uygulamis mevcut
-- bir veritabani varsa (orn. lokal dev seman) bir kez `flyway repair`
-- gerekir — bkz. README > Veritabani migration'lari.

SET @sql := (
  SELECT IF(COUNT(*) > 0,
            'ALTER TABLE `applications` MODIFY COLUMN `version` BIGINT NOT NULL DEFAULT 0',
            'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'applications' AND COLUMN_NAME = 'version'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) > 0,
            'ALTER TABLE `job_listings` MODIFY COLUMN `version` BIGINT NOT NULL DEFAULT 0',
            'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'job_listings' AND COLUMN_NAME = 'version'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(COUNT(*) > 0,
            'ALTER TABLE `shift_slots` MODIFY COLUMN `version` BIGINT NOT NULL DEFAULT 0',
            'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shift_slots' AND COLUMN_NAME = 'version'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
