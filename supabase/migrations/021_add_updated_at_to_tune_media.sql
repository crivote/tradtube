-- 021_add_updated_at_to_tune_media.sql
-- Add updated_at column to tune_media for recency ordering.

BEGIN;

-- 1. Add the column (nullable first, backfill, then set NOT NULL)
ALTER TABLE public.tune_media ADD COLUMN updated_at timestamptz DEFAULT now();

-- Backfill existing rows: set updated_at = created_at
UPDATE public.tune_media SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE public.tune_media ALTER COLUMN updated_at SET NOT NULL;

-- 2. Create trigger function to auto-update on row modification
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to tune_media
CREATE TRIGGER tune_media_set_updated_at
  BEFORE UPDATE ON public.tune_media
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 4. Index for efficient ordering
CREATE INDEX idx_tune_media_updated_at ON public.tune_media(updated_at DESC);

COMMIT;
