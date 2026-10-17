-- 022_media_availability_checks.sql
-- A: rastro pasivo de disponibilidad de vídeos desde el reproductor.
-- Cada vez que YoutubePlayer emite onError (o reproduce con éxito un vídeo
-- marcado como no disponible), se guarda un check con fecha. Sirve para
-- proponer al admin marcar un vídeo caído / desmarcar uno recuperado.
CREATE TABLE IF NOT EXISTS public.tune_media_checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id    uuid NOT NULL REFERENCES public.tune_media(id) ON DELETE CASCADE,
  ok          boolean NOT NULL,            -- true = reprodujo OK, false = onError
  error_code  integer,                     -- código de error de la IFrame API (si ok=false)
  checked_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tune_media_checks_media ON public.tune_media_checks(media_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_tune_media_checks_at    ON public.tune_media_checks(checked_at);

ALTER TABLE public.tune_media_checks ENABLE ROW LEVEL SECURITY;

-- Cualquiera (incluso anónimo) puede registrar un check: es un dato pasivo,
-- igual que un reporte. No expone nada sensible por sí solo.
CREATE POLICY "anyone_can_insert_media_checks" ON public.tune_media_checks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Solo admins pueden leer los checks y la agregación de propuestas.
CREATE POLICY "admins_can_select_media_checks" ON public.tune_media_checks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );