-- V27 — KVKK onay kaydi (users).
--  * terms_accepted_at      : Kullanim Sartlari'nin kabul edildigi an (kayit / Google ile ilk giris).
--  * privacy_notice_version : okundugu beyan edilen Aydinlatma Metni surumu (or. "2026-10-17").
--  * privacy_notice_ack_at  : bu surumun onaylandigi an.
-- Mevcut kullanicilar icin NULL (geriye uyum; e-posta/sifre girisinde yeniden istenmez).
-- Idempotent (dev DB'de ddl-auto=update kolonu once eklemis olabilir) — V21 deseni.

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'users' AND column_name = 'terms_accepted_at') = 0,
  'ALTER TABLE `users` ADD COLUMN `terms_accepted_at` datetime(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'users' AND column_name = 'privacy_notice_version') = 0,
  'ALTER TABLE `users` ADD COLUMN `privacy_notice_version` varchar(32) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE()
  AND table_name = 'users' AND column_name = 'privacy_notice_ack_at') = 0,
  'ALTER TABLE `users` ADD COLUMN `privacy_notice_ack_at` datetime(6) NULL', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
