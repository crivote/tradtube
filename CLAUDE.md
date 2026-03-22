# TradTube — Contexto para Claude Code

> Para arquitectura general, schema completo y plan de trabajo ver **INTERNAL.md** (local, no commiteado).

## Qué es este proyecto
App web que conecta el catálogo de tunes de TheSession.org con vídeos reales de YouTube.
El usuario busca una tune por nombre y obtiene clips de vídeo listos para reproducir,
con timestamps exactos de inicio y fin (imprescindible para sets donde la tune empieza en el minuto 3:47).

## Stack
- **Frontend**: SolidJS + Vite + Tailwind CSS
- **DB local**: SQLite (~11MB) cargado en cliente via @sqlite.org/sqlite-wasm — contiene las ~5000 tunes más populares de TheSession con FTS5 para búsqueda fuzzy
- **DB remota**: Supabase (PostgreSQL) — almacena los vídeos curados y votos
- **Auth**: Google OAuth via Supabase
- **Deploy**: Netlify (netlify.toml configurado con headers COOP/COEP para sqlite-wasm)

## Estado actual — Fase 1 completada
- [x] SearchView.jsx — buscador FTS5 funcionando contra SQLite local
- [x] TuneView.jsx — vista completa: lista de entries, reproductor activo, votos
- [x] YoutubePlayer.jsx — IFrame Player API con polling de timestamps (pauseVideo en end_sec)
- [x] lib/db.js — initDB, searchTunes, getSettings, getSimilarTunes
- [x] lib/supabase.js — getEntriesForTune, addVideoWithEntries, castVote, auth
- [x] store/appStore.js — signals globales, lógica de búsqueda y autoplay

## Siguiente tarea: Fase 2 — Panel de aportación

### AddVideoForm.jsx
Formulario para añadir un vídeo con su set completo:
1. Input URL de YouTube → previsualización
2. Selector de source_type
3. Añadir tunes del set: búsqueda FTS5 + campos start_sec / end_sec
4. Reordenación de entries
5. Envío via `addVideoWithEntries` (lib/supabase.js)

Acceso restringido — solo usuarios autenticados con rol autorizado.

## Convenciones
- Componentes en `src/components/`, lógica en `src/store/` y `src/lib/`
- CSS: solo Tailwind utility classes + variables CSS en `--color-*` (ver index.css)
- Sin React, sin JSX de React — esto es SolidJS: `createSignal`, `createEffect`, `Show`, `For`
- En SolidJS las signals se leen como funciones: `tune()` no `tune`

## Schema Supabase relevante
```
tune_videos        → id, youtube_id, source_type, status, added_by, created_at
tune_video_entries → id, video_id, tune_id, setting_id, start_sec, end_sec, position
tune_video_votes   → id, entry_id, user_id, vote (1/-1), is_report
```
`getEntriesForTune(tuneId)` devuelve entries con el vídeo padre embebido y voteScore calculado.

## Lo que NO tocar
- `public/thesession.db` — no regenerar, es el SQLite procesado de TheSession
- `.env.local` — tiene las keys de Supabase, no commitear
- `netlify.toml` — configurado correctamente, no tocar los headers

## Archivos clave
- `src/store/appStore.js` — estado global: `tuneEntries`, `activeEntry`, `selectedTune`
- `src/components/YoutubePlayer.jsx` — player con polling de end_sec
- `src/lib/db.js` — acceso a SQLite
- `src/lib/supabase.js` — acceso a Supabase
- `src/constants.js` — SOURCE_TYPES, SEARCH_LIMIT
