-- V15 — Entity/şema senkronu (prod ddl-auto=validate için).
--
-- Birçok özellik (yedek aday, acil ilan, e-posta doğrulama, kaydedilenler,
-- takip/engelleme, profil görüntülenme, müsaitlik blokları, SGK hatırlatıcı)
-- geliştirmede ddl-auto=update ile yazıldı ama Flyway migration'ı yoktu.
-- Sıfırdan kurulan prod DB'de Hibernate validate "missing column/table" ile
-- uygulamayı açmıyordu.
--
-- İDEMPOTENT: dev DB'lerde (ddl-auto=update) bu tablo/kolonlar zaten var.
--  * Tablolar: CREATE TABLE IF NOT EXISTS.
--  * Kolonlar: information_schema kontrolü + PREPARE (MySQL 8'de
--    ADD COLUMN IF NOT EXISTS yok); varsa DO 0 (no-op).
-- DDL, Hibernate'in ürettiğiyle birebir (kısıt/index adları dahil) — dev ve
-- prod şemaları aynı kalsın.

-- ── Eksik tablolar ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `business_blocks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `business_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_business_block` (`user_id`,`business_id`),
  KEY `idx_bb_user` (`user_id`),
  KEY `idx_bb_business` (`business_id`),
  CONSTRAINT `FK3bme8fenp78vjtupdhahymetk` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
  CONSTRAINT `FK9oj542a3ba9ietjjxy681sdc4` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `business_follows` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `business_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_business_follow` (`user_id`,`business_id`),
  KEY `idx_bf_user` (`user_id`),
  KEY `idx_bf_business` (`business_id`),
  CONSTRAINT `FKjqr4h5y8ghss8htuh3ijcaqbw` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
  CONSTRAINT `FKtq2pleng0ykfd0xtdw1ux3ieo` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `email_verification_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `token` varchar(64) NOT NULL,
  `used_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_evt_token` (`token`),
  KEY `idx_evt_user` (`user_id`),
  CONSTRAINT `FKi1c4mmamlb8keqt74k4lrtwhc` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `profile_views` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `profile_id` bigint NOT NULL,
  `viewed_at` datetime(6) NOT NULL,
  `viewer_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pv_profile_date` (`profile_id`,`viewed_at`),
  KEY `idx_pv_viewer` (`viewer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `saved_listings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `job_listing_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_listing` (`user_id`,`job_listing_id`),
  KEY `idx_saved_user` (`user_id`),
  KEY `idx_saved_listing` (`job_listing_id`),
  CONSTRAINT `FK4xvgkrkw2g0lvmdjq8cybkgk` FOREIGN KEY (`job_listing_id`) REFERENCES `job_listings` (`id`),
  CONSTRAINT `FKd14ah1y8lam2o8eyqtid7a9uv` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_availability_blocks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `day_of_week` enum('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') NOT NULL,
  `end_time` time(6) NOT NULL,
  `start_time` time(6) NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_uab_user` (`user_id`),
  CONSTRAINT `FKngmd5qc12tbfx016q043s9vgw` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Eksik kolonlar (idempotent) ──────────────────────────────────────

-- applications: SGK hatırlatıcı + yedek aday (standby)
SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'applications' AND column_name = 'sgk_reminder_sent_at') = 0,
  'ALTER TABLE `applications` ADD COLUMN `sgk_reminder_sent_at` datetime(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'applications' AND column_name = 'standby_deadline') = 0,
  'ALTER TABLE `applications` ADD COLUMN `standby_deadline` datetime(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'applications' AND column_name = 'standby_offered_at') = 0,
  'ALTER TABLE `applications` ADD COLUMN `standby_offered_at` datetime(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'applications' AND column_name = 'standby_rank') = 0,
  'ALTER TABLE `applications` ADD COLUMN `standby_rank` int NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'applications' AND column_name = 'standby_replaces_application_id') = 0,
  'ALTER TABLE `applications` ADD COLUMN `standby_replaces_application_id` bigint NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- job_listings: acil ilan + görüntülenme sayacı
-- (NOT NULL kolonlar DEFAULT ile — mevcut satırlar 0/false alır)
SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'urgent') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `urgent` bit(1) NOT NULL DEFAULT 0', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'urgent_until') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `urgent_until` datetime(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'job_listings' AND column_name = 'view_count') = 0,
  'ALTER TABLE `job_listings` ADD COLUMN `view_count` bigint NOT NULL DEFAULT 0', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- users: "hemen müsait" + e-posta doğrulama
SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'users' AND column_name = 'available_until') = 0,
  'ALTER TABLE `users` ADD COLUMN `available_until` datetime(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'users' AND column_name = 'email_verified_at') = 0,
  'ALTER TABLE `users` ADD COLUMN `email_verified_at` datetime(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'users' AND column_name = 'is_available') = 0,
  'ALTER TABLE `users` ADD COLUMN `is_available` bit(1) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
