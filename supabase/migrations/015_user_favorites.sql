-- User favorites: heart-button bookmarks on tunes
CREATE TABLE IF NOT EXISTS user_favorites (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tune_id integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, tune_id)
);

ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own favorites" ON user_favorites
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
