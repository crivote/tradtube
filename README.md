# TradTube

> Última actualización: Marzo 2026

## Descripción

Plataforma que conecta el catálogo canónico de tunes de [TheSession.org](https://thesession.org) con vídeos reales de YouTube, permitiendo a músicos de folk/trad escuchar interpretaciones auténticas de cualquier tune con un solo buscador.

El problema que resuelve: TheSession es la referencia viva para nombres, variaciones y notación ABC de tunes tradicionales, pero el MIDI generado no hace justicia al fraseo, ornamentación y ritmo real. YouTube tiene miles de actuaciones, sesiones y tutoriales, pero sin ninguna estructura que los vincule a tunes concretos ni resuelva el problema de los sets (donde el tune empieza en el minuto 3:47).

**Usuario objetivo:** músico folk/trad que quiere escuchar versiones reales de un tune para aprender, ensayar o hacer play-along.

---

## Stack técnico

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | SolidJS + Vite | Poco boilerplate, fácil de mantener, ya usado en miniapps folk |
| Base de datos tunes | SQLite local (WASM) | 11MB, carga en cliente, sin coste, sin dependencia de TheSession |
| Base de datos vídeos | Supabase (free tier) | Auth, RLS, API REST generada, PostgreSQL gestionado |
| Auth | Google OAuth via Supabase | Sin backend propio |
| Reproductor | YouTube IFrame Player API | Clips con timestamp inicio/fin controlados via JS |
| Deploy | Vercel o Cloudflare Pages | Gratis, CI/CD desde GitHub |

---

## Fuente de datos de tunes

Basada en el export oficial de TheSession (repo público en GitHub), procesada en `/home/victor/proyectos/thesession_database/`.

### Schema SQLite (thesession.db)

- **tunes** — `tune_id`, `name`, `type`, `meter`, `composer`, `tunebooks`, `popularity_score`
- **settings** — variaciones ABC por tune, con su `key` (un tune puede tener múltiples settings)
- **tunes_search** — tabla FTS5 con nombre, aliases y tipo para búsqueda fuzzy sin coste
- **tune_features** — `opening_motif`, `has_gracenotes`, `has_trills`, `has_broken_rhythm`, etc.
- **tune_similarities** — top 15 tunes similares precalculados por tune

El SQLite se distribuye como asset estático en el frontend. Primera carga ~11MB, cacheado en el navegador.

---

## Schema Supabase

### Modelo de datos

Un vídeo de YouTube puede contener un **set** de varios tunes. El schema refleja esto
con una relación 1→N entre vídeos y entries:

```
tune_videos (1) ──── (N) tune_video_entries
                              │
                              └── tune_id     (referencia al SQLite local)
                              └── start_sec / end_sec  (clip dentro del vídeo)
                              └── position    (orden dentro del set)
```

Borrado en cascada completo:
```
DELETE tune_videos → borra tune_video_entries → borra tune_video_votes
```

### `tune_videos`
```sql
id           uuid primary key
youtube_id   text not null unique
source_type  text not null  -- studio | live_concert | tv_broadcast | session | tutorial | casual
status       text not null default 'pending'  -- pending | approved | rejected
added_by     uuid references auth.users(id)
created_at   timestamptz default now()
```

### `tune_video_entries`
```sql
id           uuid primary key
video_id     uuid references tune_videos(id) on delete cascade
tune_id      integer not null          -- ID de thesession.org (SQLite local)
setting_id   integer                   -- opcional: setting concreto del SQLite
start_sec    integer not null default 0
end_sec      integer                   -- null = hasta el final
position     smallint not null default 0  -- orden dentro del set
created_at   timestamptz default now()
```

### `tune_video_votes`
```sql
id           uuid primary key
entry_id     uuid references tune_video_entries(id) on delete cascade
user_id      uuid references auth.users(id)
vote         smallint  -- 1 upvote / -1 downvote
is_report    boolean default false
created_at   timestamptz default now()
unique(entry_id, user_id)
```

---

## Funcionalidades

### MVP — Buscador público
- Búsqueda fuzzy de tunes por nombre (FTS5 sobre SQLite local)
- Resultados: clips de YouTube asociados al tune, listos para reproducir
- Reproducción automática del primer resultado
- Control de timestamps: el clip empieza y termina en el punto exacto (IFrame API)
- Badge de tipo de fuente (sesión, concierto, TV, tutorial, etc.)
- Upvote / report de entries (requiere auth con Google)

### MVP — Panel de aportación (restringido)
- Acceso solo para usuarios autorizados (RLS en Supabase)
- Formulario único para vídeo + set completo:
  1. Pegar URL de YouTube → carga el vídeo
  2. Seleccionar tipo de fuente
  3. Añadir tunes del set: búsqueda FTS5 + sliders de inicio/fin por tune
  4. Reordenación de entries en el set (flechas arriba/abajo)
  5. Envío: 1 fila en `tune_videos` + N filas en `tune_video_entries`

### Futuro
- Tags libres por entry
- Comentarios
- Tunes similares (usando `tune_similarities` del SQLite)
- Modo play-along con partitura ABC sincronizada
- Contribución abierta con moderación comunitaria

---

## Plan de trabajo

### Fase 0 — Setup
- [x] Scaffold SolidJS + Vite
- [x] Estructura de carpetas y archivos base
- [x] Crear tablas en Supabase (SQL ejecutado sin errores)
- [x] Keys de Supabase en `.env.local` (URL + publishable key)
- [x] Copiar thesession.db a /public
- [x] Verificar que FTS5 funciona en cliente
- [ ] Configurar Google OAuth (Supabase + Google Cloud Console) — puede hacerse al final de Fase 1

### Fase 1 — Buscador público
- [x] SearchView.jsx — buscador FTS5 funcionando
- [ ] TuneView.jsx — vista de tune con lista de entries
- [ ] YoutubePlayer.jsx — reproductor con control de timestamps via IFrame API
- [ ] Votos (upvote/report) con auth Google
- [ ] Google OAuth (Supabase + Google Cloud Console)
- [ ] Deploy en Vercel/Cloudflare

### Fase 2 — Panel de aportación
- [ ] AddVideoForm.jsx — formulario vídeo + set completo
  - Input URL YouTube → preview del vídeo
  - Selector de source_type
  - Lista dinámica de entries: búsqueda tune + sliders start/end
  - Reordenación de entries en el set
- [ ] Envío a Supabase (addVideoWithEntries)

### Fase 3 — Comunidad básica
- [ ] Botones upvote / downvote por entry
- [ ] Botón report (broken link)
- [ ] Ordenación de resultados por score

---

## Notas para Claude Code

Arrancar por `TuneView.jsx` y `YoutubePlayer.jsx` (Fase 1).

`YoutubePlayer` debe usar el IFrame Player API de YouTube vía JS, **no** parámetros
de URL para el end timestamp. La lógica correcta es escuchar `onStateChange` y pausar
activamente cuando `currentTime >= end_sec`.

El store usa `tuneEntries` y `activeEntry` (no `tuneVideos`/`activeVideo` — hubo
renombrado al revisar el schema para soporte de sets).

---

## Referencias

- TheSession data export: https://github.com/adactio/TheSession-data
- SQLite procesado: `/home/victor/proyectos/thesession_database/`
- Miniapps relacionadas: `/home/victor/proyectos/tune-roulette/`, `/home/victor/proyectos/guessing-tune-game/`
