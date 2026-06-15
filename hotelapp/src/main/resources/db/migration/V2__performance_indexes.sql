-- FAZ 4.7 — Sorgu performansi indexleri (FK index'lerine ek olarak)
--
-- ddl-auto:update'in eklemedigi ama sik kullanilan sorgular icin gerekli.
-- 3 composite (candidate+status, listing+status, business+status) eklenmedi
-- cunku FK index'leri zaten leading column olarak hizli yetiyor.

-- applications: status (en sik filtre + scheduler tarar)
CREATE INDEX `idx_app_status`               ON `applications` (`status`);
-- HOLD expiration scheduler hold_deadline < now() tarar
CREATE INDEX `idx_app_hold_deadline`        ON `applications` (`hold_deadline`);

-- notifications: dropdown'da sirali (DESC) son N bildirim
CREATE INDEX `idx_notif_recipient_created`  ON `notifications` (`recipient_id`, `created_at`);

-- users: role-based JOIN (admin liste, matching)
CREATE INDEX `idx_user_role`                ON `users` (`role`);

-- job_listings: public filtre (sehir/pozisyon)
CREATE INDEX `idx_listing_status_position`  ON `job_listings` (`status`, `position`);

-- audit_logs: kullanici timeline'i (DESC sirasi)
CREATE INDEX `idx_audit_actor_created`      ON `audit_logs` (`actor_id`, `created_at`);
