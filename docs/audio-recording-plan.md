# Plan de implementación — Grabaciones de audio de usuario
**Proyecto:** tradtube
**Fecha:** 2026-05-23
**Estado:** Plan de implementación — sin código

---

## Visión general

Permitir que cualquier usuario autenticado grabe interpretaciones de tunes directamente desde el navegador, las recorte, las convierta a Opus en el propio cliente, las anote con metadata de tunes (igual que los vídeos de YouTube), y las persista para que queden disponibles en tradtube junto al resto de medios.

El modelo de datos evoluciona hacia un esquema universal de `media_uri` que soporte cualquier fuente (YouTube, grabaciones propias, Archive.org, Comhaltas, Bandcamp…), y la tabla `tune_videos` se renombra a `tune_media`.

La feature se divide en fases independientes diseñadas para minimizar riesgo de regresión y permitir despliegues incrementales.

---

## Índice de fases

| Fase | Descripción | Dependencias |
|------|-------------|--------------|
| -1 | Setup: dependencias, verificación ffmpeg.wasm, mocks de test | — |
| 0A | Refactor del modelo de moderación | -1 |
| 0B | Migración del schema: `tune_media` + `media_uri` | 0A |
| 1A | Componente `AudioRecorder` (captura, waveform, trim, conversión Opus) | -1 |
| 1B | Extracción de `TuneEntriesEditor` + `AddRecordingForm` | — |
| 2 | Capa de persistencia: Supabase Storage + escritura en DB | 0B, 1A, 1B |
| 3 | Vista de grabaciones del usuario (gestión propia) | 2 |
| 4 | Tab separado vídeos / grabaciones en `TuneView` | 2 |

Fases 1A y 1B son independientes entre sí y pueden desarrollarse en paralelo.

---

## Fase -1 — Setup y verificación previa

**Objetivo:** Instalar dependencias necesarias, verificar compatibilidad técnica del stack, y preparar infraestructura de testing antes de escribir código de feature.

### Instalación de dependencias

```bash
npm install @ffmpeg/ffmpeg
```

El build audio-only (`@ffmpeg/core` con perfil `audio`) pesa ~3 MB gzippeado. No se instala `@ffmpeg/core` como dependencia directa — ffmpeg.wasm lo descarga on-demand desde CDN la primera vez.

### Verificación de SharedArrayBuffer (SAB)

El `netlify.toml` tiene COEP desactivado porque bloquea iframes de YouTube. Algunos builds de ffmpeg.wasm requieren `SharedArrayBuffer`, que a su vez requiere COEP. **Antes de escribir código de Fase 1A**, verificar con un script throwaway en el navegador:

```javascript
// Script de verificación — no commitear
const { createFFmpeg } = await import('@ffmpeg/ffmpeg');
const ffmpeg = createFFmpeg({ log: true });
await ffmpeg.load();
// Si llega aquí sin error de SAB, el build es compatible
```

Si el build elegido requiere SharedArrayBuffer, hay un conflicto sin solución fácil: activar COEP rompe YouTube. **Este es el único punto del plan que podría convertirse en bloqueante técnico.** Alternativas si falla:
- Usar `ffmpeg.audio.wasm` (build específico audio-only que no requiere SAB).
- Usar Web Audio API puro + `OpusMediaEncoder` (solo Chrome) como fallback progresivo.
- Usar `lamejs` para MP3 como fallback (mayor tamaño, menor calidad, pero sin dependencia WASM).

### Configuración de mocks para tests

Crear `src/__tests__/mocks/supabase.js`:

```javascript
// Mock reutilizable del cliente Supabase para tests unitarios
// Expone: mockSupabase, mockAuth, mockStorage, mockFrom
// Cada test puede espiar métodos individuales con vi.fn()
```

**No es necesario mockear SQLite** — los tests existentes no lo hacen. Solo Supabase requiere mock porque hace llamadas de red.

Las funciones `getEntriesForTune`, `checkYoutubeIdExists`, `getVideoCountsByTune`, etc. se testearán como unit tests con Supabase mockeado, verificando que la query construida es correcta (`.eq()`, `.select()`, etc.) y que la transformación de datos posterior es correcta.

### Criterio de completitud
- `@ffmpeg/ffmpeg` instalado en `package.json`.
- Verificación SAB completada y documentada (compatible o ruta alternativa decidida).
- `src/__tests__/mocks/supabase.js` creado con mock funcional.
- `npm run test:run` pasa con los 3 tests existentes sin cambios (verificación de no regresión).

---

## Fase 0A — Refactor del modelo de moderación

**Objetivo:** Pasar de moderación previa (pending → approved) a publicación inmediata con revisión a posteriori (new → reviewed). Todo el contenido es visible desde el momento en que se añade. El panel admin es un tracker de "qué he revisado ya", no una cola de aprobación.

**Skill recomendada:** `supabase-postgres-best-practices` — para auditar RLS policies antes del cambio de constraints.

### Supabase Action Sheet 0A.1 — Migración SQL

Ejecutar en SQL Editor del dashboard de Supabase, en una transacción:

```sql
-- 007_moderation_refactor.sql
BEGIN;

-- 1. Cambiar el constraint CHECK
ALTER TABLE tune_videos
  DROP CONSTRAINT IF EXISTS tune_videos_status_check;

ALTER TABLE tune_videos
  ADD CONSTRAINT tune_videos_status_check
  CHECK (status IN ('new', 'reviewed'));

-- 2. Migrar datos existentes
UPDATE tune_videos SET status = 'reviewed' WHERE status = 'approved';
UPDATE tune_videos SET status = 'new'      WHERE status = 'pending';

-- 3. Verificar que no quedan valores huérfanos
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM tune_videos
    WHERE status NOT IN ('new', 'reviewed');
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Hay % filas con status inválido', orphan_count;
  END IF;
END $$;

COMMIT;
```

### Supabase Action Sheet 0A.2 — Auditoría de RLS Policies

**Hacer esto ANTES del deploy de código.** En el dashboard de Supabase → Authentication → Policies, buscar en la tabla `tune_videos` cualquier policy que contenga `status = 'approved'` en su cláusula `USING` o `WITH CHECK`. Reemplazar por `status IN ('new', 'reviewed')` o eliminar el filtro de status directamente (ambos valores son públicos).

Una policy típica que necesita cambio:

```sql
-- Antes (policy SELECT pública)
CREATE POLICY "Public read approved videos" ON tune_videos
  FOR SELECT USING (status = 'approved');

-- Después (todo visible)
CREATE POLICY "Public read all non-hidden media" ON tune_videos
  FOR SELECT USING (true);
  -- O si ya existe hidden: USING (hidden = false)
```

Verificar con query de diagnóstico:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'tune_videos'
  AND (qual::text LIKE '%approved%' OR with_check::text LIKE '%approved%');
```

Debe devolver 0 filas tras la auditoría.

### Cambios en el código

**`src/lib/supabase.js`** — Mapa completo de funciones afectadas:

| Función | Cambio |
|---------|--------|
| `getEntriesForTune` (línea 33) | `.filter(e => e.tune_videos?.status === 'approved' ...)` → eliminar filtro JS. Content público. Mantener solo `!e.tune_videos?.unavailable`. |
| `getVideoCountsByTune` (línea 248) | `.eq('status', 'approved')` → `.neq('status', null)` o eliminar filtro. |
| `getTuneIdsByInstrument` (línea 274) | `.eq('tune_videos.status', 'approved')` → eliminar `.eq()` de status. |
| `getVideosByTune` (línea 163) | `.eq('tune_videos.status', 'approved')` → eliminar. |
| `getLatestApprovedVideos` (línea 130) | `.eq('status', 'approved')` → `.order('created_at', ...)` sin filtro de status. Renombrar función a `getLatestMedia`. |
| `getPendingVideos` (línea 148) | `.eq('status', 'pending')` → `.eq('status', 'new')`. |
| `approveVideo` (línea 185) | `{ status: 'approved' }` → `{ status: 'reviewed' }`. Renombrar función a `reviewVideo`. |
| `getPendingCount` (línea 226) | `.eq('status', 'pending')` → `.eq('status', 'new')`. |

**`src/components/AdminView.jsx`:**
- Importar `reviewVideo` en vez de `approveVideo`.
- "Aprobar" → "Marcar como revisado" (`status = 'reviewed'`).
- "Rechazar" desaparece. Si algo no debe estar, se elimina directamente con `deleteVideo`.
- Badge de pendientes muestra items con `status = 'new'`.

**`src/constants.js`:**
- Eliminar referencias a `'approved'` / `'pending'` si existen.

**`src/store/appStore.js`:**
- `pendingReviewCount` se calcula con `getPendingCount()` que ahora usa `status = 'new'`. Sin cambios necesarios si `getPendingCount` se actualiza correctamente.

### Tests — Fase 0A

Crear `src/__tests__/supabase.test.js`:

```javascript
// Tests que verifican que las queries no filtran por status
// Usan el mock de Supabase para espiar .eq() calls
```

Casos de test mínimos:

| Test | Verifica |
|------|---------|
| `getEntriesForTune no filtra por status` | El `.filter()` JS no excluye `new`/`reviewed` |
| `getVideoCountsByTune no usa .eq('status')` | La query no tiene filtro de status |
| `getTuneIdsByInstrument no tiene .eq('tune_videos.status')` | La query no filtra por status del video |
| `reviewVideo usa status = 'reviewed'` | El update contiene `{ status: 'reviewed' }` |
| `getPendingCount usa status = 'new'` | La query usa `.eq('status', 'new')` |
| `getPendingVideos usa status = 'new'` | La query usa `.eq('status', 'new')` |

### Criterio de completitud
- Contenido existente visible sin cambio de comportamiento percibido.
- Sin referencias a `'approved'` ni `'pending'` en código JS ni en RLS policies.
- Panel admin refleja correctamente `new` / `reviewed`.
- `npm run test:run` pasa (3 tests existentes + nuevos de Fase 0A).
- Query de diagnóstico de RLS (Action Sheet 0A.2) devuelve 0 filas.

---

## Fase 0B — Migración del schema: `tune_media` + `media_uri`

**Objetivo:** Renombrar `tune_videos` a `tune_media`, eliminar `youtube_id` (reemplazado por `media_uri`), y migrar los registros de YouTube al nuevo esquema.

**Dependencia:** Fase 0A desplegada.

**Skill recomendada:** `supabase-postgres-best-practices` — referencias `schema-foreign-key-indexes.md` para asegurar que los FK se recrean con índices.

### Decisión sobre `youtube_id`

Se elimina como campo. `YoutubePlayer.jsx` extrae el ID parseando `media_uri`:

```javascript
// La función extractYoutubeId YA existe en src/lib/utils.js
// Solo cambia su input: antes recibía youtube_id, ahora recibe media_uri
export function extractYoutubeId(uri) {
  const match = uri?.match(/[?&]v=([^&]+)/) ?? uri?.match(/youtu\.be\/([^?]+)/);
  return match?.[1] ?? null;
}
```

### Supabase Action Sheet 0B.1 — Migración SQL completa

Ejecutar en SQL Editor, en una transacción. **Las RLS policies no se renombran automáticamente al renombrar tablas ni al renombrar columnas. Recrearlas manualmente.**

```sql
-- 008_tune_media_schema.sql
BEGIN;

-- ── 1. Renombrar tabla principal ──
ALTER TABLE tune_videos RENAME TO tune_media;

ALTER TABLE tune_media ADD COLUMN media_uri       TEXT;
ALTER TABLE tune_media ADD COLUMN performer_name  TEXT;
ALTER TABLE tune_media ADD COLUMN recording_notes TEXT;

-- Migrar youtube_id → media_uri (URL canónica)
UPDATE tune_media
  SET media_uri = 'https://www.youtube.com/watch?v=' || youtube_id
  WHERE youtube_id IS NOT NULL;

-- Verificar integridad de la migración
DO $$
DECLARE
  null_yt integer;
BEGIN
  SELECT count(*) INTO null_yt FROM tune_media
    WHERE source_type = 'youtube' AND media_uri IS NULL;
  IF null_yt > 0 THEN
    RAISE EXCEPTION 'Hay % vídeos de YouTube sin media_uri', null_yt;
  END IF;
END $$;

ALTER TABLE tune_media DROP COLUMN youtube_id;

CREATE INDEX idx_tune_media_source_type ON tune_media(source_type);

-- ── 2. Renombrar tabla de entries ──
ALTER TABLE tune_video_entries RENAME TO tune_media_entries;
ALTER TABLE tune_media_entries RENAME COLUMN video_id TO media_id;

-- ── 3. Renombrar tabla de votes (requiere recrear FK) ──
ALTER TABLE tune_video_votes RENAME TO tune_media_votes;

-- El FK constraint mantiene su nombre original tras el rename de tabla.
-- Debemos renombrarlo explícitamente para consistencia, y la columna.
ALTER TABLE tune_media_votes RENAME COLUMN entry_id TO entry_id;  -- no cambia
-- Si existía un FK explícito nombrado, renombrarlo:
-- ALTER TABLE tune_media_votes RENAME CONSTRAINT fk_votes_entry TO fk_media_votes_entry;

-- ── 4. Renombrar tabla de reports ──
ALTER TABLE tune_video_reports RENAME TO tune_media_reports;
ALTER TABLE tune_media_reports RENAME COLUMN video_id TO media_id;

-- ── 5. Recrear RLS policies para TODAS las tablas renombradas ──
-- ⚠️ Las policies se pierden al renombrar. Recrear manualmente:

-- tune_media: SELECT público, INSERT authenticated, UPDATE/DELETE admin
-- tune_media_entries: SELECT público, INSERT authenticated
-- tune_media_votes: SELECT público, INSERT/UPSERT authenticated (dueño)
-- tune_media_reports: INSERT público, SELECT/UDPATE admin

-- (Ver Action Sheet 0B.2 abajo para el SQL completo de RLS)

-- ── 6. Verificar integridad referencial ──
-- Comprobar que no hay entries huérfanas
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count FROM tune_media_entries e
    LEFT JOIN tune_media m ON e.media_id = m.id
    WHERE m.id IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Hay % entries huérfanas (sin media padre)', orphan_count;
  END IF;
END $$;

COMMIT;
```

### Supabase Action Sheet 0B.2 — Recreación de RLS Policies

Después del rename, recrear **todas** las policies. Si se usa el dashboard, recrear una por una. Si se usa SQL Editor, ejecutar:

```sql
-- Habilitar RLS en todas las tablas renombradas
ALTER TABLE tune_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE tune_media_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tune_media_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tune_media_reports ENABLE ROW LEVEL SECURITY;

-- tune_media: lectura pública (solo no-hidden si ya existe el campo; si no, sin filtro)
CREATE POLICY "Public can read tune_media" ON tune_media
  FOR SELECT USING (true);

-- tune_media: inserción solo authenticated
CREATE POLICY "Authenticated can insert tune_media" ON tune_media
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- tune_media: update/delete solo admin (o dueño)
CREATE POLICY "Admin can update tune_media" ON tune_media
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can delete tune_media" ON tune_media
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- tune_media_entries: lectura pública
CREATE POLICY "Public can read tune_media_entries" ON tune_media_entries
  FOR SELECT USING (true);

-- tune_media_entries: inserción authenticated
CREATE POLICY "Authenticated can insert tune_media_entries" ON tune_media_entries
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- tune_media_votes: lectura pública
CREATE POLICY "Public can read tune_media_votes" ON tune_media_votes
  FOR SELECT USING (true);

-- tune_media_votes: upsert solo el propio usuario
CREATE POLICY "Users can upsert own votes" ON tune_media_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes" ON tune_media_votes
  FOR UPDATE USING (auth.uid() = user_id);

-- tune_media_reports: insert público (con o sin auth)
CREATE POLICY "Anyone can insert reports" ON tune_media_reports
  FOR INSERT WITH CHECK (true);

-- tune_media_reports: select/update admin
CREATE POLICY "Admin can read reports" ON tune_media_reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin can update reports" ON tune_media_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
```

### ⚠️ Pitfall: `checkYoutubeIdExists` necesita reescritura lógica

Esta función hace `.eq('youtube_id', youtubeId)`. Después de la migración, el campo no existe. La query completa debe cambiar:

```javascript
// src/lib/supabase.js — checkYoutubeIdExists
// Antes (línea 94)
.eq('youtube_id', youtubeId)

// Después
.eq('media_uri', `https://www.youtube.com/watch?v=${youtubeId}`)
```

Sin este cambio, la detección de duplicados en `AddVideoForm` falla silenciosamente y se pueden insertar el mismo vídeo dos veces sin aviso.

### Cambios en el código — Mapa de reemplazos

Búsqueda y reemplazo en `src/` — verificar cada instancia manualmente, **no hacer replace ciego**:

| Buscar | Reemplazar | Contexto |
|--------|-----------|----------|
| `tune_videos` | `tune_media` | Nombres de tabla en `.from()` |
| `tune_video_entries` | `tune_media_entries` | Nombres de tabla en `.from()` y `.select()` |
| `tune_video_votes` | `tune_media_votes` | Nombres de tabla en `.from()` y `.select()` |
| `tune_video_reports` | `tune_media_reports` | Nombres de tabla en `.from()` |
| `video_id` (en entries/reports) | `media_id` | Columnas en inserts/selects |
| `youtube_id` | `media_uri` | Ver pitfall arriba — cada instancia requiere análisis individual |
| `tune_videos!inner(status)` | `tune_media!inner(status)` | Join en `getVideosByTune` |
| `tune_videos(status)` | `tune_media(status)` | Join en `getEntriesForTune` |
| `approveVideo` (ya renombrada en 0A) | `reviewVideo` | Export/import de función |

### Tests — Fase 0B

Añadir a `src/__tests__/supabase.test.js`:

| Test | Verifica |
|------|---------|
| `extractYoutubeId extrae de media_uri` | La función existente en utils funciona con URLs completas (ya testeado en youtubeUtils.test.js) |
| `checkYoutubeIdExists busca por media_uri` | La query usa `.eq('media_uri', ...)` con URL canónica |
| `getEntriesForTune usa tune_media en join` | La query reference `tune_media` no `tune_videos` |
| `castVote usa tune_media_votes` | La query usa `.from('tune_media_votes')` |
| `createReport usa tune_media_reports` | La query usa `.from('tune_media_reports')` |
| `getVideoCountsByTune usa tune_media` | La query reference tabla renombrada |

### Criterio de completitud
- Vídeos de YouTube funcionan sin cambio de comportamiento.
- Sin referencias a `youtube_id` como campo de base de datos en el código.
- Sin referencias a `tune_videos`, `tune_video_entries`, `tune_video_votes`, `tune_video_reports` en código.
- Todas las tablas tienen su nombre definitivo en la DB y en el código.
- `checkYoutubeIdExists` detecta duplicados correctamente con el nuevo campo.
- `npm run test:run` pasa (tests existentes + Fase 0A + Fase 0B).
- RLS policies de Action Sheet 0B.2 aplicadas y verificadas.

---

## Fase 1A — Componente `AudioRecorder`

**Objetivo:** Captura de audio, waveform, trim duro y conversión a Opus en el navegador. Output: `Blob` Opus recortado listo para subir. Sin llamadas de red en toda la fase.

**Skill recomendada:** `ux-researcher-designer` — para validar los estados de la máquina de estados, los mensajes de error, y el flujo de trim desde la perspectiva del usuario músico (no técnico).

### Carga lazy de ffmpeg.wasm

ffmpeg.wasm (build audio-only) pesa ~3 MB gzippeado. Se carga únicamente cuando el usuario inicia el flujo de conversión:

```javascript
// En el componente padre — lazy load del componente completo
const AudioRecorder = lazy(() => import('./AudioRecorder.jsx'));

// Dentro de AudioRecorder.jsx — lazy load de ffmpeg solo al convertir
const { createFFmpeg, fetchFile } = await import('@ffmpeg/ffmpeg');
```

El sqlite de thesession se carga al arrancar porque es necesario para búsqueda global. ffmpeg.wasm se carga on-demand. No compiten.

### Máquina de estados

```
idle → requesting_mic → recording → recorded → trimming → converting_loading_wasm → converting → ready
               ↓ (permiso denegado)
           mic_error
```

**`idle`:** Botón "Grabar". No solicita permisos del micrófono hasta que el usuario interactúa.

**`requesting_mic`:** `getUserMedia({ audio: true })`. Si deniega → `mic_error` con mensaje claro y enlace a instrucciones de cómo habilitarlo en el navegador del usuario.

**`recording`:**
- `MediaRecorder` captura en memoria como Blob parciales.
- `AudioContext` + `AnalyserNode` → waveform en tiempo real (canvas + `requestAnimationFrame`).
- Contador de tiempo transcurrido.
- Límite de **10 minutos** (no 30 — ver pitfall de memoria abajo). Aviso al minuto 9.
- Botón "Detener".

**`recorded`:**
- Waveform estática. Reproductor `<audio>` para preescucha.
- Dos sliders de trim (`trimStart` / `trimEnd`) superpuestos sobre la waveform.
- Copy explicativo claro: estos sliders recortan el **archivo** (eliminan silencios o errores al inicio/final). Son distintos de los marcadores de inicio/fin de cada tune, que se definen en el siguiente paso.
- Botón "Aplicar trim y convertir". Botón "Grabar de nuevo" (descarta el audio actual).

**`trimming`:** Web Audio API:
1. `AudioContext.decodeAudioData(blob)` → `AudioBuffer` completo.
2. Crear `AudioBuffer` nuevo con la duración `[trimStart, trimEnd]`.
3. Copiar frames con `copyFromChannel` / `copyToChannel`.

⚠️ Ver pitfall de iOS AudioContext abajo — `decodeAudioData` debe ejecutarse en contexto de gesto.

**`converting_loading_wasm`:** Estado visible mientras ffmpeg.wasm se descarga la primera vez. Mensaje: "Cargando conversor de audio (solo la primera vez)…" con spinner. En visitas posteriores el módulo está en caché del navegador y este estado es imperceptible.

**`converting`:**
1. Serializar `AudioBuffer` a WAV en memoria (~20 líneas sin librería: PCM raw + header WAV).
2. ffmpeg.wasm: `ffmpeg -i input.wav -c:a libopus -b:a 96k output.ogg`
3. Extraer `Blob` resultante.

Barra de progreso visible (ffmpeg.wasm emite eventos de progreso). Tiempo estimado para 1 minuto de audio: 2-5 segundos en ordenador moderno. Resultado: ~720 KB/min a 96 kbps.

**`ready`:** Waveform del audio recortado. Reproductor de preescucha. Tamaño del archivo visible. Emite `onAudioReady(blob, durationSeconds)` al componente padre. Botón "Grabar de nuevo" disponible.

### ⚠️ Pitfall: iOS AudioContext en estado suspended

iOS Safari requiere que `AudioContext` sea creado o reanudado dentro de un handler directo de gesto del usuario. Si se crea en un effect o al montar el componente, queda en estado `suspended` y `decodeAudioData` falla silenciosamente. Llamar a `audioContext.resume()` explícitamente dentro del handler del botón "Aplicar trim", no antes.

### ⚠️ Pitfall: explosión de memoria con `decodeAudioData`

`decodeAudioData` convierte el audio comprimido a PCM raw. Para 10 minutos: ~10 MB WebM en memoria + ~190 MB de AudioBuffer PCM (10 min × 44100 Hz × 2 canales × 4 bytes). En móvil gama baja esto puede agotar la memoria y matar la pestaña. Límite de 10 minutos es el máximo razonable — comunicarlo al usuario como característica del grabador ("máximo 10 minutos por grabación"), no como error técnico.

### ⚠️ Pitfall: stream del micrófono no liberado al navegar

Si el usuario navega a otra ruta con la grabación activa, `MediaRecorder` sigue corriendo y el indicador de micrófono del navegador permanece encendido. El `onCleanup` de SolidJS debe ejecutar:

```javascript
onCleanup(() => {
  mediaRecorder?.stop();
  stream?.getTracks().forEach(t => t.stop());
  audioContext?.close();
});
```

### ⚠️ Pitfall: sin protección ante navegación con trabajo no guardado

Si el usuario ha grabado y recortado y navega accidentalmente a otra página, el blob se pierde (no sobrevive a navegaciones). Implementar un `beforeunload` handler cuando hay un blob activo no guardado:

```javascript
const handleBeforeUnload = (e) => { e.preventDefault(); };
// Registrar cuando blob existe, desregistrar cuando se publica o descarta
window.addEventListener('beforeunload', handleBeforeUnload);
onCleanup(() => window.removeEventListener('beforeunload', handleBeforeUnload));
```

### Compatibilidad

`MediaRecorder` disponible en todos los navegadores modernos incluido Safari 14.1+ (2021). Para navegadores sin soporte: mensaje informativo, no error técnico. El componente completo solo se renderiza si el usuario está autenticado — si no lo está, renderizar el botón de login en su lugar.

### Tests — Fase 1A

Crear `src/__tests__/audioRecorder.test.js`. Dado que AudioRecorder usa APIs del navegador (`MediaRecorder`, `AudioContext`, `getUserMedia`), los tests unitarios se enfocan en lógica pura extraíble:

| Archivo | Qué testea |
|---------|-----------|
| `src/__tests__/audioUtils.test.js` | Funciones puras: serialización WAV (`audioBufferToWav`), cálculo de duración, validación de trim bounds |
| `src/__tests__/audioRecorder.test.js` | Lógica de máquina de estados extraída como reducer: transiciones válidas, estados de error, límite de 10 min |

Tests de integración manual (no automatizados — requieren APIs de navegador reales):
- Grabar 10s, trim, convertir → verificar que el OGG resultante se reproduce en `<audio>`.
- Verificar que el stream se libera al desmontar (sin indicador de micrófono residual).
- Verificar `beforeunload` en Chrome y Firefox.

### Criterio de completitud
- Grabar, visualizar, trim, convertir → `Blob` Opus en memoria.
- Duración del `Blob` corresponde exactamente al rango del trim.
- Reproducible en `<audio>` nativo.
- Stream del micrófono liberado en `onCleanup`.
- `beforeunload` activo mientras hay blob no guardado.
- Sin llamadas de red.
- `npm run test:run` pasa con tests de utilidades de audio.

---

## Fase 1B — `TuneEntriesEditor` y `AddRecordingForm`

**Objetivo:** Extraer la lógica de entries de `AddVideoForm` en subcomponente reutilizable. Crear `AddRecordingForm`. Sin llamadas de red.

**Skill recomendada:** `tailwind-design-system` — para consistencia visual entre `AddVideoForm`, `TuneEntriesEditor` y `AddRecordingForm`.

### Extracción de `TuneEntriesEditor`

**`TuneEntriesEditor.jsx`** — nuevo componente, recibe:
- `entries` / `setEntries`: lista con su estado.
- `audioDuration` (opcional): duración total del medio, para validar que `end_sec` no la supera.
- `audioCurrentTime` (opcional): posición actual del reproductor, para el botón "Marcar aquí".
- `initialTune` (opcional): tune pre-poblado en el primer entry.

No sabe nada de YouTube ni de grabaciones. Es pura lógica de entries.

**`AddVideoForm.jsx`** pasa a usar `TuneEntriesEditor` internamente. Sin cambio de comportamiento externo.

### `AddRecordingForm.jsx`

Recibe `blob`, `durationSeconds` e `initialTune` (el tune de la página desde la que se inició el grabador, para pre-poblar el primer entry sin que el usuario tenga que buscarlo manualmente).

**Reproductor de preescucha:**
`<audio src={objectUrl}>` donde `objectUrl = URL.createObjectURL(blob)`. La posición actual del reproductor se pasa a `TuneEntriesEditor` para el botón "Marcar aquí" (mismo patrón que `YoutubePlayer`).

**Campos de metadata:**

| Campo | Tipo | Notas |
|-------|------|-------|
| `performer_name` | text | Por defecto nombre de Google del usuario (`authUser.user_metadata?.full_name`). Editable. |
| `recording_notes` | textarea | Descripción libre opcional (lugar, fecha, contexto). |

**Entries:** `<TuneEntriesEditor initialTune={initialTune}>` — idéntico al flujo YouTube. Los `start_sec`/`end_sec` son relativos al inicio del audio ya recortado.

**Validaciones:** al menos un entry; timestamps dentro de `[0, durationSeconds]`; `performer_name` no vacío.

**Output:** `onSubmit({ blob, performer_name, recording_notes, entries })`.

### ⚠️ Pitfall: memory leak de `URL.createObjectURL`

`URL.createObjectURL(blob)` crea una referencia al blob que el GC no puede liberar por sí solo. Revocar siempre en `onCleanup` y cuando se recibe un blob nuevo:

```javascript
let objectUrl;
createEffect(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(props.blob);
});
onCleanup(() => { if (objectUrl) URL.revokeObjectURL(objectUrl); });
```

### ⚠️ Pitfall: sesión expirada durante el flujo

Grabar + revisar + anotar puede tomar 25-40 minutos. Las sesiones de Supabase expiran. Si el token caduca mientras el usuario está en el formulario, `addRecordingWithEntries` lanzará "Must be logged in" — y el blob solo existe en memoria. El usuario perdería la grabación al refrescar. Antes de iniciar el upload, verificar/refrescar el token:

```javascript
const { data: { session } } = await supabase.auth.getSession();
if (!session) throw new Error('Session expired — please log in again');
// O mejor: await supabase.auth.refreshSession()
```

### Tests — Fase 1B

Crear `src/__tests__/tuneEntriesEditor.test.js` y `src/__tests__/addRecordingForm.test.js`:

| Archivo | Qué testea |
|---------|-----------|
| `tuneEntriesEditor.test.js` | Validación de entries: bounds check contra `audioDuration`, al menos un entry requerido, orden correcto de `position`, timestamps no negativos |
| `addRecordingForm.test.js` | Validación de `performer_name` no vacío, `initialTune` pre-pobla correctamente, `onSubmit` emite el payload esperado |

### Criterio de completitud
- `TuneEntriesEditor` funciona en `AddVideoForm` sin regresión (test visual manual).
- `AddRecordingForm` pre-popula el primer entry con el `initialTune`.
- `URL.createObjectURL` se revoca en `onCleanup`.
- Verificación de sesión antes del submit.
- Sin llamadas de red.
- `npm run test:run` pasa con tests de Fase 1B.

---

## Fase 2 — Capa de persistencia (Supabase Storage, beta)

**Dependencias:** Fases 0B, 1A y 1B completas.

**Skill recomendada:** `supabase-postgres-best-practices` — referencias de RLS policies para Storage (paths con user_id) y de queries para el patrón de inserción transaccional con rollback.

### Supabase Action Sheet 2.1 — Crear bucket `user-recordings`

Ejecutar en SQL Editor de Supabase **antes del deploy de código**:

```sql
-- Crear el bucket (esto también puede hacerse desde el dashboard SQL o la API de Storage)
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-recordings', 'user-recordings', true)
ON CONFLICT (id) DO NOTHING;
```

### Supabase Action Sheet 2.2 — RLS Policies para Storage

Las policies de Storage se manejan en la tabla `storage.objects`. Crear las siguientes:

```sql
-- Permitir lectura pública de todos los objetos del bucket
CREATE POLICY "Public read user-recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-recordings');

-- Permitir INSERT solo a usuarios autenticados, en su propio path
-- El path debe ser {user_id}/{filename}
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-recordings'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir DELETE al dueño (cuyo user_id está en el path) o al admin
CREATE POLICY "Owner or admin can delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-recordings'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
);
```

**Verificar policies:**

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage';
```

### Nueva función `addRecordingWithEntries` en `src/lib/supabase.js`

```javascript
// Pseudocódigo — no código final
async function addRecordingWithEntries({ blob, performer_name, recording_notes, entries }) {
  // Verificar/refrescar sesión antes de cualquier operación
  await supabase.auth.refreshSession();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');

  const fileName = `${user.id}/${crypto.randomUUID()}.ogg`;

  // 1. Subir el Blob
  const { error: storageError } = await supabase.storage
    .from('user-recordings')
    .upload(fileName, blob, { contentType: 'audio/ogg; codecs=opus', upsert: false });
  if (storageError) throw storageError;

  // 2. URL pública
  const { data: urlData } = supabase.storage
    .from('user-recordings').getPublicUrl(fileName);

  // 3. Insertar en tune_media
  const { data: media, error: mediaError } = await supabase
    .from('tune_media')
    .insert({
      source_type: 'user_recording',
      media_uri: urlData.publicUrl,
      status: 'new',
      added_by: user.id,
      performer_name,
      recording_notes: recording_notes || null,
    }).select().single();

  if (mediaError) {
    // Rollback parcial: borrar archivo de Storage
    await supabase.storage.from('user-recordings').remove([fileName]);
    throw mediaError;
  }

  // 4. Insertar entries
  const { error: entriesError } = await supabase
    .from('tune_media_entries')
    .insert(entries.map((e, i) => ({
      media_id: media.id,
      tune_id: e.tune_id,
      setting_id: e.setting_id ?? null,
      start_sec: e.start_sec ?? 0,
      end_sec: e.end_sec ?? null,
      position: i,
      instruments: e.instruments?.length > 0 ? e.instruments : null,
      key: e.key ?? null,
    })));

  if (entriesError) {
    // Rollback completo: borrar entries (si alguna se insertó parcialmente),
    // borrar registro tune_media y borrar archivo de Storage
    await supabase.from('tune_media').delete().eq('id', media.id);
    await supabase.storage.from('user-recordings').remove([fileName]);
    throw entriesError;
  }

  return media;
}
```

### ⚠️ Pitfall: grabaciones visibles en TuneView sin reproductor (gap Fase 2 → Fase 4)

Fase 2 inserta grabaciones con `source_type = 'user_recording'` y las queries públicas las devuelven. Pero `TuneView` renderiza cada item con `YoutubePlayer`, que intentará extraer un `youtube_id` de una URL de Supabase Storage y fallará.

**Solución para el periodo entre Fase 2 y Fase 4:** filtrar `user_recording` de las queries de `TuneView` hasta que `AudioPlayer` esté listo. El filtro se elimina cuando se despliega Fase 4. Alternativa preferida: renderizar un `<audio controls src={media_uri}>` básico como placeholder si `source_type === 'user_recording'` — esto permite ver la grabación de inmediato sin esperar a Fase 4.

### Orquestador `AddRecordingFlow.jsx`

```
AudioRecorder  →  onAudioReady(blob, duration)
AddRecordingForm  →  onSubmit({ blob, performer_name, recording_notes, entries })
addRecordingWithEntries()  →  Toast de confirmación + navegación al tune
```

Punto de entrada: botón "Grabar interpretación" en `TuneView.jsx`, visible solo para usuarios autenticados, que pasa `initialTune` al flujo. Implementar como modal para que el usuario no pierda el contexto del tune mientras graba.

### Tests — Fase 2

Crear `src/__tests__/addRecording.test.js` usando el mock de Supabase:

| Test | Verifica |
|------|---------|
| `addRecordingWithEntries sube blob al path correcto` | `.upload()` llamado con `{user.id}/{uuid}.ogg` |
| `addRecordingWithEntries inserta en tune_media con source_type` | `.insert()` contiene `source_type: 'user_recording'` |
| `addRecordingWithEntries inserta entries con media_id` | Las entries usan el `media.id` retornado |
| `rollback de storage si falla tune_media` | `.remove()` llamado cuando la inserción en tune_media falla |
| `rollback completo si fallan entries` | `.delete()` + `.remove()` llamados cuando entries falla |
| `refreshSession llamado antes del upload` | `supabase.auth.refreshSession` espiado antes de cualquier operación |
| `lanza error si no hay sesión` | `getUser` retorna null → error |

### Criterio de completitud
- Grabación visible en la vista del tune (con placeholder `<audio>` si Fase 4 no está lista).
- Archivo OGG en Storage con URL pública accesible.
- Panel admin muestra la grabación con estado `new`.
- Rollback completo: Storage + tune_media si falla entries.
- `npm run test:run` pasa con tests de Fase 2.
- RLS policies de Storage verificadas: un usuario no puede subir al path de otro usuario.

---

## Fase 3 — Vista de grabaciones propias del usuario

**Objetivo:** Control total del usuario sobre sus grabaciones. No se permite editar la relación con tunes una vez publicada.

### Supabase Action Sheet 3.1 — Migración SQL (columna `hidden`)

**Orden obligatorio: SQL antes que código.** La columna `hidden` debe existir en la DB antes de desplegar el código que la referencia.

```sql
-- 009_hidden_flag.sql
ALTER TABLE tune_media ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_tune_media_hidden ON tune_media(hidden);
```

Las queries públicas (`getEntriesForTune`, `getVideoCountsByTune`, `getTuneIdsByInstrument`, `getLatestMedia`) añaden `.eq('hidden', false)` o `.neq('hidden', true)` al desplegarse este cambio.

### `UserRecordingsView.jsx`

Accesible desde el menú de usuario (avatar/header) cuando está autenticado. Consulta:

```javascript
supabase.from('tune_media')
  .select(`id, media_uri, performer_name, recording_notes, status, hidden, created_at,
    tune_media_entries(tune_id, start_sec, end_sec, instruments, key, position)`)
  .eq('source_type', 'user_recording')
  .eq('added_by', user.id)
  .order('created_at', { ascending: false })
```

Por cada grabación: reproductor `<audio>` nativo, lista de tunes con links, fecha, intérprete, notas, estado.

**Acciones:**

| Acción | Comportamiento |
|--------|----------------|
| **Descargar** | Fetch del blob + `URL.createObjectURL` + click programático. **No** `<a download>` directo — el atributo `download` no funciona cross-origin (Supabase Storage es `*.supabase.co`). |
| **Ocultar / Mostrar** | Toggle del campo `hidden`. No borra. La grabación deja de aparecer en vistas públicas. Reversible. |
| **Eliminar** | Modal de confirmación explícita antes de actuar (no toast de undo posterior). Borra registro en DB (cascade entries y votes) + archivo en Storage. La eliminación es irreversible — no puede deshacerse con el patrón de undo del proyecto porque el archivo de Storage se destruye en el mismo acto. |

### ⚠️ Pitfall: "undo" de eliminación no es reversible

El patrón de toast con undo del proyecto (ej. features previas) funciona para operaciones de DB reversibles. La eliminación de una grabación implica borrar el archivo de Storage, que es inmediata e irreversible. No aplicar el patrón de undo aquí — usar confirmación previa con modal o toast de "¿Estás seguro? Esta acción no se puede deshacer."

### Tests — Fase 3

Crear `src/__tests__/userRecordings.test.js`:

| Test | Verifica |
|------|---------|
| `query filtra por source_type y added_by` | La query usa `.eq('source_type', 'user_recording')` y `.eq('added_by', user.id)` |
| `toggle hidden actualiza solo el campo hidden` | El update contiene `{ hidden: true/false }` sin tocar otros campos |
| `delete elimina registro DB + archivo Storage` | `.delete()` + `.remove()` llamados secuencialmente |
| `delete requiere rol admin o dueño` | Policy de Storage verificada (test de integración manual) |
| `queries públicas filtran hidden = false` | `getEntriesForTune` y demás añaden `.eq('hidden', false)` |

### Criterio de completitud
- Usuario ve todas sus grabaciones en un único sitio.
- Descarga funciona correctamente cross-origin.
- Ocultar/mostrar funciona sin borrar.
- Eliminar requiere confirmación explícita y es permanente.
- Grabaciones ocultas no aparecen en vistas de tunes.
- `npm run test:run` pasa con tests de Fase 3.

---

## Fase 4 — Tab separado vídeos / grabaciones en `TuneView`

### `TuneView.jsx`

Dos tabs:
- **"Vídeos":** `source_type !== 'user_recording'`
- **"Grabaciones":** `source_type = 'user_recording'` + `hidden = false`

Tab con cero items: badge `(0)` + deshabilitado. Al desplegar esta fase, eliminar el filtro/placeholder provisional introducido en Fase 2.

Nota: la etiqueta "Vídeos" será semánticamente imprecisa cuando se añadan fuentes como Comhaltas o Bandcamp. Diseñar el tab con esto en mente (quizás "Vídeos y audio externo" o simplemente el ícono correspondiente).

### `AudioPlayer.jsx`

- `<audio controls src={media_uri}>` con estilos coherentes con el diseño.
- Nombre del intérprete y notas visibles.
- Marcas de tune (`start_sec`/`end_sec`): usar `requestAnimationFrame` polling en lugar de el listener `timeupdate`. El evento `timeupdate` del `<audio>` nativo se dispara cada ~250ms, lo cual produce un sobrepasamiento audible en el punto de pausa. `requestAnimationFrame` da precisión de ~16ms, igual que el patrón ya usado en `YoutubePlayer`.

### Tests — Fase 4

Crear `src/__tests__/audioPlayer.test.js`:

| Test | Verifica |
|------|---------|
| `requestAnimationFrame polling pausa en end_sec` | La lógica de polling detiene la reproducción cuando `currentTime >= end_sec` |
| `filtro de tabs separa source_types correctamente` | `user_recording` va a tab Grabaciones, el resto a Vídeos |

Test de integración manual: verificar que los tabs funcionan en móvil y que la pausa en `end_sec` es musicalmente precisa (no se escucha la nota siguiente).

### Criterio de completitud
- Los dos tabs funcionan y filtran correctamente.
- `AudioPlayer` pausa en `end_sec` con precisión musical aceptable.
- Funciona correctamente en móvil.
- `npm run test:run` pasa con tests de Fase 4.

---

## Resumen de dependencias

```
Fase -1 (setup + verificación)
    ↓
Fase 0A (moderación)
    ↓
Fase 0B (schema tune_media + media_uri)
    ↓                         ↓
Fase 1A (AudioRecorder)   Fase 1B (TuneEntriesEditor + AddRecordingForm)
    ↓_________________________↓
Fase 2 (persistencia Supabase Storage)
    ↓               ↓
Fase 3 (vista     Fase 4 (tabs vídeos/grabaciones)
  usuario)
```

---

## Plan de testing — Resumen

| Archivo de test | Fase | Tipo | Framework |
|-----------------|------|------|-----------|
| `src/__tests__/supabase.test.js` | 0A, 0B | Unit (mock Supabase) | Vitest + vi.fn() |
| `src/__tests__/audioUtils.test.js` | 1A | Unit (funciones puras) | Vitest |
| `src/__tests__/audioRecorder.test.js` | 1A | Unit (state machine) | Vitest |
| `src/__tests__/tuneEntriesEditor.test.js` | 1B | Unit (validación) | Vitest |
| `src/__tests__/addRecordingForm.test.js` | 1B | Unit (validación) | Vitest |
| `src/__tests__/addRecording.test.js` | 2 | Integration (mock Supabase) | Vitest + vi.fn() |
| `src/__tests__/userRecordings.test.js` | 3 | Unit (mock Supabase) | Vitest + vi.fn() |
| `src/__tests__/audioPlayer.test.js` | 4 | Unit (polling logic) | Vitest |
| Manual QA checklist | 1A, 2, 4 | Integration (navegador real) | Checklist en issue |

**Tests existentes que no se modifican (solo verificar que siguen pasando):**
- `src/__tests__/timeUtils.test.js`
- `src/__tests__/titleUtils.test.js`
- `src/__tests__/youtubeUtils.test.js`

Ejecutar `npm run test:run` al final de cada fase. No desplegar si hay tests rotos.

---

## Supabase Action Sheets — Índice

| Sheet | Fase | Qué contiene |
|-------|------|-------------|
| 0A.1 | 0A | Migración SQL: constraint CHECK + data migration |
| 0A.2 | 0A | Auditoría de RLS policies existentes |
| 0B.1 | 0B | Migración SQL: rename tablas + columnas + data migration |
| 0B.2 | 0B | Recreación de RLS policies post-rename |
| 2.1 | 2 | Creación del bucket `user-recordings` |
| 2.2 | 2 | RLS policies para Storage (lectura pública, escritura scoped por user_id) |
| 3.1 | 3 | Migración SQL: columna `hidden` + índice |

---

## Skills y agentes recomendados por fase

| Fase | Skill/Agente | Propósito |
|------|-------------|-----------|
| -1 | — | Setup manual, sin dependencia de skills |
| 0A | `supabase-postgres-best-practices` | Auditar RLS policies antes del cambio de constraints; asegurar que los índices existen para las queries afectadas |
| 0B | `supabase-postgres-best-practices` | Validar que los FK constraints se recrean con índices (`schema-foreign-key-indexes.md`); verificar que las nuevas queries usan índices existentes o crear los necesarios |
| 1A | `ux-researcher-designer` | Validar la máquina de estados desde la perspectiva del usuario músico; testear mensajes de error y flujo de trim con usuarios no técnicos |
| 1A | `tailwind-design-system` | Diseño del waveform canvas, sliders de trim, y barra de progreso de conversión |
| 1B | `tailwind-design-system` | Consistencia visual entre AddVideoForm, TuneEntriesEditor y AddRecordingForm |
| 2 | `supabase-postgres-best-practices` | RLS de Storage; índices para queries por `source_type` y `added_by`; patrón de inserción con rollback |
| 3 | — | CRUD estándar; sin dependencia de skills |
| 4 | `tailwind-design-system` | Diseño del componente AudioPlayer y tabs en TuneView |

---

## Anexo A — Migración a Archive.org API

### Motivación

Archive.org ofrece ownership real para el intérprete: cada grabación tiene un permalink permanente independiente de tradtube. Coherente con la filosofía del proyecto como capa de descubrimiento, no como silo.

### Por qué requiere servidor intermediario

Las credenciales S3-compatible de Archive.org no pueden ir al cliente. El límite de 256 KB de payload de Netlify Functions impide enviar el archivo directamente. Flujo:

```
Cliente convierte a Opus → sube a Supabase Storage (buffer temporal)
    ↓
Cliente llama a Netlify Background Function con el path del archivo
    ↓
Function: descarga de Storage → sube a Archive.org → actualiza media_uri en Supabase → borra buffer temporal
```

**Netlify Background Functions:** timeout 15 minutos, disponibles en tier Pro ($20/mes). Para 1 minuto de audio la operación completa tarda pocos segundos — el timeout no es un problema. La subida a Archive.org puede ser lenta en horas de carga del servidor (30-120 segundos para 3-4 MB) — comunicarlo al usuario de forma realista.

### Consentimiento explícito antes del archivado permanente

Antes de iniciar la subida a Archive.org, mostrar al usuario un aviso claro con confirmación:

> "Tu grabación quedará archivada permanentemente en Archive.org como contenido público. Podrás ocultarla en tradtube, pero el archivo en Archive.org es esencialmente permanente e independiente de esta plataforma. ¿Continuar?"

Esto no es opcional — es un requisito de transparencia hacia el usuario.

### Identificador de ítem

```
tradtube-{user_hash}-{yyyymmdd}-{uuid_corto}
```

Sin `tune_id` en el identificador — una grabación puede contener varios tunes. Los tunes van en la metadata del ítem, no en el identificador.

### Metadata enviada a Archive.org

| Campo | Valor |
|---|---|
| `title` | `{tune_names_joined} — played by {performer_name}` |
| `creator` | `{performer_name}` |
| `subject` | `traditional music; {tune_types}; {tune_names}` |
| `description` | `{recording_notes}` + "Recorded via tradtube: {url_del_tune}" |
| `mediatype` | `audio` |
| `collection` | `opensource_audio` (o colección propia `tradtube`) |
| `source` | URL del tune en tradtube |
| `date` | Fecha de grabación (ISO) |

Solicitar la colección `tradtube` al equipo de Archive.org antes de la migración. Los ítems quedarán agrupados en `archive.org/details/tradtube`.

### UX durante la transición asíncrona

Añadir campo `processing boolean DEFAULT false` en `tune_media`. Mientras es `true`, la grabación ya es visible en tradtube (vía URL de Storage temporal) pero con un indicador discreto: "Archivando permanentemente en Archive.org…". Cuando la Background Function termina, actualiza `media_uri` + `processing = false`. La UI refresca vía Supabase Realtime. El mensaje debe preparar al usuario para que este proceso puede tardar varios minutos.

### Comparativa beta vs. definitivo

| Aspecto | Beta (Supabase Storage) | Definitivo (Archive.org) |
|---|---|---|
| URL permanente | No | Sí, independiente de tradtube |
| Ownership del intérprete | No | Sí |
| Borrado | Posible | Muy difícil (Archive.org es permanente) |
| Coste | ~$0 hasta 1 GB | $0 almacenamiento + $20/mes Netlify Pro |
| Indexado público | No | Sí |

### Migración de grabaciones existentes

Script opcional: re-subir cada archivo a Archive.org y actualizar `media_uri`. No urgente — las URLs de Supabase Storage siguen funcionando. Sin cambio de schema.
