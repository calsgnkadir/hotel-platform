-- Bounded XLSX snapshots (max 2 MiB raw, 4 MiB complete JSON) survive provider retries.
-- Existing EMAIL rows remain readable; delivered payloads are redacted as before.
ALTER TABLE outbox_events MODIFY COLUMN payload MEDIUMTEXT NOT NULL;
