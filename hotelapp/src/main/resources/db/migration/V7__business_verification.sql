-- FAZ G.3 — Isletme KYC onay (verified rozet)
-- verifiedAt NOT NULL = halka acik altin rozet gosterilir.
-- verifiedBy = onayi veren admin id (audit izi).

ALTER TABLE `businesses`
    ADD COLUMN `verified_at` DATETIME(6) NULL,
    ADD COLUMN `verified_by` BIGINT     NULL;

-- Hızlı "onaysız işletme" listesi icin
CREATE INDEX `idx_businesses_verified_at` ON `businesses` (`verified_at`);
