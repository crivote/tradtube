-- 018_add_albums_and_fix_bpm.sql
-- Corrección de modelo: BPM pertenece a entries (por segmento), no al media.
-- Nueva tabla albums para deduplicar metadatos de álbum.
BEGIN;

-- 1. Nueva tabla albums
CREATE TABLE IF NOT EXISTS public.albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thesession_recording_id INTEGER UNIQUE,
    title TEXT NOT NULL,
    artist TEXT,
    release_year INTEGER,
    cover_url TEXT,
    thesession_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Nuevas columnas en tune_media
ALTER TABLE public.tune_media
    ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES public.albums(id),
    ADD COLUMN IF NOT EXISTS album_track INTEGER;

-- 3. Nuevas columnas en tune_media_entries
ALTER TABLE public.tune_media_entries
    ADD COLUMN IF NOT EXISTS bpm INTEGER,
    ADD COLUMN IF NOT EXISTS scale TEXT;

-- 4. Dropear bpm de tune_media (mal ubicado; los datos estaban al 99.4% NULL)
ALTER TABLE public.tune_media
    DROP COLUMN IF EXISTS bpm;

COMMIT;
