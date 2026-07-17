-- 020_add_tune_entry_gaps_view.sql
-- Vista para detectar gaps temporales entre tunes, late starts, y anomalías de datos
-- en tune_media_entries.
-- + RLS en tabla albums (sin políticas previas)
-- + Función admin-only get_tune_entry_gaps() para acceso desde cliente

-- Tipos de issue detectados:
--   BIG_GAP            (>15s)  gap entre el final de una tune y el inicio de la siguiente
--   SMALL_GAP          (3-15s) gap pequeño (probable charla/afinación)
--   LATE_START         (>30s)  contenido antes de la primera tune identificada
--   NULL_END_NOT_LAST          end_sec=NULL en una entry que no es la última (dato incorrecto)

-- Uso desde SQL directo (Management API / Dashboard):
--   SELECT * FROM v_tune_entry_gaps WHERE issue_type IS NOT NULL;
-- Uso desde cliente Supabase (requiere rol admin):
--   SELECT * FROM get_tune_entry_gaps();

-- ============================================================
-- 1. Vista v_tune_entry_gaps
-- ============================================================
CREATE OR REPLACE VIEW v_tune_entry_gaps AS
WITH entry_window AS (
  SELECT
    e.media_id,
    e.position,
    e.start_sec,
    e.end_sec,
    e.tune_id,
    LEAD(e.start_sec) OVER (PARTITION BY e.media_id ORDER BY e.position) AS next_start,
    ROW_NUMBER() OVER (PARTITION BY e.media_id ORDER BY e.position) AS rn,
    COUNT(*) OVER (PARTITION BY e.media_id) AS total_entries
  FROM tune_media_entries e
)
SELECT
  m.id AS media_id,
  m.title,
  m.media_uri,
  m.source_type,
  ew.total_entries,
  ew.position,
  ew.start_sec,
  ew.end_sec,
  ew.next_start,
  CASE
    WHEN ew.end_sec IS NOT NULL AND ew.next_start IS NOT NULL
      THEN ew.next_start - ew.end_sec
    WHEN ew.rn = 1 AND ew.start_sec > 0
      THEN ew.start_sec
    ELSE NULL
  END AS gap_sec,
  CASE
    WHEN ew.end_sec IS NULL AND ew.next_start IS NOT NULL
      THEN 'NULL_END_NOT_LAST'
    WHEN ew.rn = 1 AND ew.start_sec > 30
      THEN 'LATE_START'
    WHEN ew.end_sec IS NOT NULL AND ew.next_start IS NOT NULL
         AND (ew.next_start - ew.end_sec) > 15
      THEN 'BIG_GAP'
    WHEN ew.end_sec IS NOT NULL AND ew.next_start IS NOT NULL
         AND (ew.next_start - ew.end_sec) BETWEEN 3 AND 15
      THEN 'SMALL_GAP'
    ELSE NULL
  END AS issue_type
FROM entry_window ew
JOIN tune_media m ON ew.media_id = m.id;

-- ============================================================
-- 2. RLS para tabla albums
--    (la tabla no tenía RLS activado ni políticas previas)
--    Se alinea con el patrón de tune_media:
--    - SELECT: público
--    - INSERT: authenticated + service_role
--    - UPDATE: authenticated
--    - DELETE: solo admin
-- ============================================================
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read albums"
  ON public.albums FOR SELECT USING (true);

CREATE POLICY "Authenticated insert albums"
  ON public.albums FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Service role insert albums"
  ON public.albums FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated update albums"
  ON public.albums FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Admin delete albums"
  ON public.albums FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  ));

-- ============================================================
-- 3. Función admin-only para acceso cliente a la vista
--    SECURITY DEFINER → ejecuta como owner, bypass RLS subyacente.
--    Lanza error si el usuario no tiene rol 'admin'.
-- ============================================================
CREATE OR REPLACE FUNCTION get_tune_entry_gaps()
RETURNS TABLE(
  media_id       uuid,
  title          text,
  media_uri      text,
  source_type    text,
  total_entries  bigint,
  "position"     smallint,
  start_sec      integer,
  end_sec        integer,
  next_start     integer,
  gap_sec        integer,
  issue_type     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY SELECT * FROM v_tune_entry_gaps;
END;
$$;
