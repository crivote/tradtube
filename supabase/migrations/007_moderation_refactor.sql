-- 007_moderation_refactor.sql
-- Phase 0A: pending → new, approved → reviewed
BEGIN;

-- 1. Drop old constraint and add new one
ALTER TABLE tune_videos
  DROP CONSTRAINT IF EXISTS tune_videos_status_check;

ALTER TABLE tune_videos
  ADD CONSTRAINT tune_videos_status_check
  CHECK (status IN ('new', 'reviewed'));

-- 2. Migrate existing data
UPDATE tune_videos SET status = 'reviewed' WHERE status = 'approved';
UPDATE tune_videos SET status = 'new'      WHERE status = 'pending';

-- 3. Verify no orphan values
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM tune_videos
    WHERE status NOT IN ('new', 'reviewed');
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Hay % filas con status invalido', orphan_count;
  END IF;
END $$;

COMMIT;
