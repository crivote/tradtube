-- 014_add_bpm_to_tune_media.sql
-- Add optional BPM field to tune_media for recordings/videos
BEGIN;

ALTER TABLE tune_media ADD COLUMN bpm integer;

COMMIT;
