-- Nullable for historical/GPS sessions whose shift cannot be reconstructed safely.
-- Preserve historical rows; attribution is handled by ShiftAttendance on read.
ALTER TABLE work_sessions ADD COLUMN shift_slot_id BIGINT NULL;
ALTER TABLE work_sessions ADD CONSTRAINT uk_ws_application_shift
    UNIQUE (application_id, shift_slot_id);
