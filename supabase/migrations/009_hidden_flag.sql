-- 009_hidden_flag.sql
-- Phase 3: hidden flag for user recordings management
BEGIN;

ALTER TABLE tune_media ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_tune_media_hidden ON tune_media(hidden);

COMMIT;
