-- 017_change_favorites_to_entry.sql
-- Refactor: user_favorites now references tune_media_entries.id instead of tune_id.
-- This makes favorites track specific video/recording entries (with timestamps),
-- not abstract tunes that can have multiple entries.

-- Drop old table (tune_id is integer, cannot be mapped to entry_id automatically)
DROP TABLE IF EXISTS user_favorites;

-- Recreate with entry_id referencing tune_media_entries
CREATE TABLE user_favorites (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES tune_media_entries(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, entry_id)
);

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own favorites" ON user_favorites
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
