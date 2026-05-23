-- 008_tune_media_schema.sql
-- Phase 0B: tune_videos → tune_media, youtube_id → media_uri
-- ⚠️ RLS policies DO NOT auto-rename. Recreate after execution via Action Sheet 0B.2.
BEGIN;

-- ── 1. Rename main table ──
ALTER TABLE tune_videos RENAME TO tune_media;

ALTER TABLE tune_media ADD COLUMN media_uri       TEXT;
ALTER TABLE tune_media ADD COLUMN performer_name  TEXT;
ALTER TABLE tune_media ADD COLUMN recording_notes TEXT;

UPDATE tune_media
  SET media_uri = 'https://www.youtube.com/watch?v=' || youtube_id
  WHERE youtube_id IS NOT NULL;

DO $$
DECLARE
  null_yt integer;
BEGIN
  SELECT count(*) INTO null_yt FROM tune_media
    WHERE source_type = 'youtube' AND media_uri IS NULL;
  IF null_yt > 0 THEN
    RAISE EXCEPTION 'There are % youtube rows without media_uri', null_yt;
  END IF;
END $$;

ALTER TABLE tune_media DROP COLUMN youtube_id;

CREATE INDEX idx_tune_media_source_type ON tune_media(source_type);

-- ── 2. Rename entries table ──
ALTER TABLE tune_video_entries RENAME TO tune_media_entries;
ALTER TABLE tune_media_entries RENAME COLUMN video_id TO media_id;

-- ── 3. Rename votes table ──
ALTER TABLE tune_video_votes RENAME TO tune_media_votes;

-- ── 4. Rename reports table ──
ALTER TABLE tune_video_reports RENAME TO tune_media_reports;
ALTER TABLE tune_media_reports RENAME COLUMN video_id TO media_id;

-- ── 5. Verify referential integrity ──
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM tune_media_entries e
    LEFT JOIN tune_media m ON e.media_id = m.id
    WHERE m.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'There are % orphan entries (no parent media)', orphan_count;
  END IF;
END $$;

COMMIT;

-- ⚠️ RLS policies must be recreated manually after this migration.
-- Run Action Sheet 0B.2 SQL to recreate policies on all renamed tables.
