-- 019_drop_thesession_recording_id.sql
-- La columna ha sido reemplazada por album_id (FK → albums).
-- Todos los media que tenían thesession_recording_id ya tienen album_id.
-- Verificación previa: SELECT count(*) FROM tune_media
--   WHERE thesession_recording_id IS NOT NULL AND album_id IS NULL;
--   → 0 rows (confirmado 2026-07-16).
BEGIN;

ALTER TABLE public.tune_media
    DROP COLUMN IF EXISTS thesession_recording_id;

COMMIT;
