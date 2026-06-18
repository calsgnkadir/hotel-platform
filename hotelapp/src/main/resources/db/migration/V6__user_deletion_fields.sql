-- FAZ D.8 — KVKK soft delete fields
--
-- deletion_requested_at: kullanici "hesabimi sil" tıklamasi
-- scheduled_anonymize_at: bu tarih sonrasi PII anonymize edilir (30 gun grace)

ALTER TABLE `users`
    ADD COLUMN `deletion_requested_at` DATETIME(6) NULL,
    ADD COLUMN `scheduled_anonymize_at` DATETIME(6) NULL;

-- Pending deletion'lari scheduler hizla bulabilsin
CREATE INDEX `idx_users_anonymize_due`
    ON `users` (`scheduled_anonymize_at`);
