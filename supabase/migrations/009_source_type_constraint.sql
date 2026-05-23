-- 009_source_type_constraint.sql
-- Fix: allow user_recording, comhaltas, bandcamp source types
BEGIN;

ALTER TABLE tune_media
  DROP CONSTRAINT IF EXISTS tune_videos_source_type_check;

ALTER TABLE tune_media
  ADD CONSTRAINT tune_videos_source_type_check
  CHECK (source_type IN ('studio', 'album', 'live_concert', 'tv_broadcast', 'session', 'tutorial', 'casual', 'user_recording', 'comhaltas', 'bandcamp'));

COMMIT;
