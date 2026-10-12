-- V24 — Zamanlayici/filtre sorgulari icin eksik indeksler.
--  * applications.standby_deadline : yedek teklifi suresi dolanlari tarayan
--                                    zamanlayici (standby_deadline < now()).
--  * shift_slots.date              : tarih araligi filtreleri ve gecmis vardiya
--                                    taramalari.
--  * users.scheduled_anonymize_at  : KVKK anonimlestirme zamanlayicisi.
--                                    NOT: V6 bu kolonu `idx_users_anonymize_due`
--                                    ile zaten indeksliyor; asagidaki kontrol
--                                    sayesinde mukerrer indeks EKLENMEZ.
--  * users.available_until         : "hemen musait" havuzu sorgulari.
-- Idempotent: ayni ADLI indeks varsa YA DA kolon herhangi bir indeksin en sol
-- (seq_in_index = 1) kolonuysa atlanir — dev DB'de ddl-auto=update veya baska
-- adla eklenmis indekslerle mukerrer olusturmaz.
-- InnoDB ikincil indeks ekleme ALGORITHM=INPLACE, LOCK=NONE (online) calisir.

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE()
  AND table_name = 'applications'
  AND (index_name = 'idx_app_standby_deadline' OR (column_name = 'standby_deadline' AND seq_in_index = 1))) = 0,
  'CREATE INDEX `idx_app_standby_deadline` ON `applications` (`standby_deadline`)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE()
  AND table_name = 'shift_slots'
  AND (index_name = 'idx_slot_date' OR (column_name = 'date' AND seq_in_index = 1))) = 0,
  'CREATE INDEX `idx_slot_date` ON `shift_slots` (`date`)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND (index_name = 'idx_user_sched_anonymize' OR (column_name = 'scheduled_anonymize_at' AND seq_in_index = 1))) = 0,
  'CREATE INDEX `idx_user_sched_anonymize` ON `users` (`scheduled_anonymize_at`)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @s := IF((SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE()
  AND table_name = 'users'
  AND (index_name = 'idx_user_available_until' OR (column_name = 'available_until' AND seq_in_index = 1))) = 0,
  'CREATE INDEX `idx_user_available_until` ON `users` (`available_until`)', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
