-- 013_tune_comments.sql
-- Tune comments system with public profiles table
BEGIN;

-- ── Public profiles table ──

CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url   text,
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ── Auto-create profile on signup ──

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Backfill existing users ──

INSERT INTO public.profiles (id, display_name, avatar_url)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'full_name', SPLIT_PART(email, '@', 1)),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ── Tune comments table ──

CREATE TABLE tune_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tune_ref    integer NOT NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at  timestamptz DEFAULT now(),
  edited_at   timestamptz
);

CREATE INDEX ON tune_comments (tune_ref, created_at);

ALTER TABLE tune_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tune_comments_select_public" ON tune_comments
  FOR SELECT USING (true);

CREATE POLICY "tune_comments_insert_auth" ON tune_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tune_comments_update_own" ON tune_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "tune_comments_delete_own_or_admin" ON tune_comments
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

COMMIT;
