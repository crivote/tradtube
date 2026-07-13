-- 016_user_playlists.sql
-- User-generated playlists — ordered collections of tune_media_entries references.

CREATE TABLE IF NOT EXISTS user_playlists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_playlist_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id uuid REFERENCES user_playlists(id) ON DELETE CASCADE NOT NULL,
  entry_id uuid REFERENCES tune_media_entries(id) ON DELETE CASCADE NOT NULL,
  position integer NOT NULL DEFAULT 0,
  added_at timestamptz DEFAULT now(),
  UNIQUE (playlist_id, entry_id)
);

-- RLS: owners can CRUD their playlists; anyone can read public ones
ALTER TABLE user_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_playlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own playlists" ON user_playlists
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "read public playlists" ON user_playlists FOR SELECT
  USING (is_public = true);

CREATE POLICY "own playlist items" ON user_playlist_items
  USING (EXISTS (
    SELECT 1 FROM user_playlists WHERE id = playlist_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_playlists WHERE id = playlist_id AND user_id = auth.uid()
  ));

CREATE POLICY "read public playlist items" ON user_playlist_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_playlists WHERE id = playlist_id AND is_public = true
  ));
