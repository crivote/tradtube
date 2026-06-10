-- 012_llm_guess_status.sql
-- Add 'llm_guess' to the status check constraint for LLM-inserted videos
BEGIN;

ALTER TABLE tune_media
  DROP CONSTRAINT IF EXISTS tune_media_status_check;

ALTER TABLE tune_media
  ADD CONSTRAINT tune_media_status_check
  CHECK (status IN ('new', 'reviewed', 'llm_guess'));

COMMIT;
