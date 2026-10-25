-- V28 — Ayni adayin ayni ilana birden fazla AKTIF basvurusunu veritabani duzeyinde engeller.
--
-- Is kurali (ApplicationService.ACTIVE_FOR_DUPLICATE): PENDING, REVIEWING, HELD, STANDBY,
-- ACCEPTED aktif sayilir; REJECTED / EXPIRED / WITHDRAWN sonrasi ayni ilana yeniden
-- basvurulabilir. Bu yuzden duz UNIQUE(candidate_id, job_listing_id) KULLANILMAZ.
-- MySQL'de kismi indeks olmadigi icin:
--  * active_listing_key : VIRTUAL generated kolon; aktif durumlarda job_listing_id, degilse NULL.
--  * uk_applications_candidate_active_listing : UNIQUE(candidate_id, active_listing_key).
--    NULL degerler cakismaz -> sonuclanmis basvurular sinirsiz birikebilir.
-- VIRTUAL: kolon ekleme tabloyu yeniden yazmaz (INSTANT); deger yalniz indekste tutulur.
-- Uygulama bu kolona yazmaz (entity'de insertable/updatable=false).
--
-- Veri degistirilmez. Mevcut veride ayni (aday, ilan) icin birden fazla aktif basvuru varsa
-- migration ACIK bir hatayla durur (asagidaki tespit sorgusu); kayitlar elle cozulmeden
-- (karar gerektirir) ilerlemez. Tespit:
--   SELECT candidate_id, job_listing_id, COUNT(*) AS adet, GROUP_CONCAT(id ORDER BY id) AS ids
--   FROM applications
--   WHERE status IN ('PENDING','REVIEWING','HELD','STANDBY','ACCEPTED')
--   GROUP BY candidate_id, job_listing_id HAVING COUNT(*) > 1;
--
-- Idempotent (dev DB'de ddl-auto=update kolonu/indeksi once eklemis olabilir) — V21 deseni.

-- 1) On kontrol: cakisan aktif basvuru varsa var olmayan bir tabloya basvurarak dur.
--    (SIGNAL hazirlanmis ifadede calismaz; hata metni tablo adinda okunur.)
SET @dup := (SELECT COUNT(*) FROM (
  SELECT 1 FROM `applications`
  WHERE `status` IN ('PENDING','REVIEWING','HELD','STANDBY','ACCEPTED')
  GROUP BY `candidate_id`, `job_listing_id` HAVING COUNT(*) > 1) d);
SET @s := IF(@dup > 0,
  'SELECT 1 FROM `V28_HATA_cakisan_aktif_basvuru_var_tespit_sorgusuna_bakin`',
  'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 2) Generated kolon
SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'applications' AND column_name = 'active_listing_key') = 0,
  'ALTER TABLE `applications` ADD COLUMN `active_listing_key` bigint GENERATED ALWAYS AS (CASE WHEN `status` IN (''PENDING'',''REVIEWING'',''HELD'',''STANDBY'',''ACCEPTED'') THEN `job_listing_id` ELSE NULL END) VIRTUAL',
  'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 3) Benzersizlik
SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE()
  AND table_name = 'applications' AND index_name = 'uk_applications_candidate_active_listing') = 0,
  'CREATE UNIQUE INDEX `uk_applications_candidate_active_listing` ON `applications` (`candidate_id`, `active_listing_key`)',
  'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
