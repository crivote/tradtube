# TradTube — Contexto para Claude Code

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

## Estado actual
- [x] SearchView.jsx — buscador FTS5 funcionando contra SQLite local
- [x] TuneView.jsx — placeholder vacío, hay que construirlo
- [x] lib/db.js — initDB, searchTunes, getSettings, getSimilarTunes
- [x] lib/supabase.js — getEntriesForTune, addVideoWithEntries, castVote, auth
- [x] store/appStore.js — signals globales, lógica de búsqueda y autoplay

## Siguiente tarea: TuneView.jsx + YoutubePlayer.jsx

### TuneView.jsx
Debe mostrar:
1. Nombre del tune + metadatos (type, meter) del SQLite
2. Lista de entries (vídeos) obtenidas de Supabase via `getEntriesForTune`
3. Reproductor activo para la entry seleccionada (autoplay del primero)
4. Botones upvote / report por entry (requiere auth)
5. Badge de source_type por entry
6. Botón "back to search"

### YoutubePlayer.jsx
IMPORTANTE: usar YouTube IFrame Player API via JS, NO parámetros de URL para el end timestamp.
La lógica correcta es:
- Cargar la IFrame API dinámicamente (una sola vez)
- Crear el player con `start` en la URL del embed
- Escuchar `onStateChange` y hacer `player.pauseVideo()` cuando `player.getCurrentTime() >= end_sec`
- Usar `setInterval` para el polling de currentTime (cada 500ms es suficiente)

Props esperadas: `{ youtubeId, startSec, endSec, autoplay }`

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
- `src/lib/db.js` — acceso a SQLite
- `src/lib/supabase.js` — acceso a Supabase
- `src/constants.js` — SOURCE_TYPES, SEARCH_LIMIT
