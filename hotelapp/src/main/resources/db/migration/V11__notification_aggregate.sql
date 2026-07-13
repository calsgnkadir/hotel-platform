-- FAZ 11 Wave 4.1 — Notification dedupe/aggregation
--
-- Ayni recipient + type icin 5dk penceresinde gelen bildirimler tek kayda
-- collapse edilir: aggregate_count artar, message en yenisiyle guncellenir.
-- "24 ayri toast" yerine "3 yeni basvuru (×3)" UX'i.

ALTER TABLE `notifications`
    ADD COLUMN `aggregate_count` INT NOT NULL DEFAULT 1,
    ADD KEY `idx_notif_dedupe` (`recipient_id`, `type`, `is_read`, `created_at`);
