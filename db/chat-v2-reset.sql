-- ====================================================================
-- Chat refactor v2 — DB temizlik script'i
-- ====================================================================
-- Yeni başvuru akışına geçişle birlikte mevcut tüm başvuru/mesaj/bildirim
-- kayıtları silinmelidir. Kullanıcılar, ilanlar, işletmeler ve KORUNUR.
--
-- ÇALIŞTIRMA:
--   Lokal: MySQL Workbench → bu dosyayı aç → Execute (Ctrl+Shift+Enter)
--   Prod:  Railway dashboard → MySQL service → Data → Query → yapıştır → Run
-- ====================================================================

USE hotel_platform;

SET FOREIGN_KEY_CHECKS = 0;

-- Bildirimler
TRUNCATE TABLE notifications;

-- Mesajlaşma
TRUNCATE TABLE messages;
TRUNCATE TABLE conversations;

-- Başvurular + ilgili tablolar
TRUNCATE TABLE document_requests;
TRUNCATE TABLE application_requested_slots;
TRUNCATE TABLE availability;
TRUNCATE TABLE applications;

-- Değerlendirmeler ve audit kayıtları
TRUNCATE TABLE reviews;
TRUNCATE TABLE audit_logs;

-- Password reset (varsa eski tokenları)
TRUNCATE TABLE password_reset_tokens;

SET FOREIGN_KEY_CHECKS = 1;

-- Kontrol — hepsi 0 olmalı
SELECT
  (SELECT COUNT(*) FROM notifications)              AS notifications,
  (SELECT COUNT(*) FROM messages)                   AS messages,
  (SELECT COUNT(*) FROM conversations)              AS conversations,
  (SELECT COUNT(*) FROM applications)               AS applications,
  (SELECT COUNT(*) FROM reviews)                    AS reviews,
  (SELECT COUNT(*) FROM audit_logs)                 AS audit_logs;

-- KORUNAN tablolar (silinmedi) — sayıları kontrol için
SELECT
  (SELECT COUNT(*) FROM users)        AS users_preserved,
  (SELECT COUNT(*) FROM businesses)   AS businesses_preserved,
  (SELECT COUNT(*) FROM job_listings) AS listings_preserved,
  (SELECT COUNT(*) FROM documents)    AS documents_preserved;
