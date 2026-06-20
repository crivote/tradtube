# TradTube

> Find real performances for any traditional Irish tune — with exact timestamps.

TradTube connects the [TheSession.org](https://thesession.org) tune catalogue with curated YouTube clips and user recordings. Search for a tune by name and get real performances ready to play, with start/end timestamps that handle sets correctly (e.g. a tune that starts at 3:47 in a longer video).

**Built for:** folk and traditional musicians who want to hear authentic performances of a tune to learn, practice, or play along.

---

## The problem it solves

TheSession is the canonical reference for tune names, ABC notation, and settings — but the MIDI it generates doesn't capture real phrasing, ornamentation, or rhythm. YouTube has thousands of sessions, concerts, and tutorials, but no structure linking them to specific tunes, and no way to handle sets where the tune you want starts three minutes in.

TradTube bridges both: structured tune data + video clips with precise timestamps.

---

## Features

- **Fuzzy search** across ~5,000 popular tunes (FTS5, runs entirely in the browser)
- **Filters by tune type** (jig, reel, hornpipe, polka, slide, waltz, march, slip jig) and **instrument**
- **YouTube player** with exact start/end timestamps — essential for sets
- **Segment loop toggle + progress bar** inside the player
- **Curated entries** with source type badges (studio, album, live concert, session, tutorial, casual…)
- **Community voting** — upvote/downvote/report entries (Google login)
- **Add videos** — authenticated users can submit YouTube videos with one or more tune entries
- **Import from TheSession** — pull existing TheSession recordings into the submission form
- **User audio recordings** — record, convert with ffmpeg.wasm, and publish your own playing
- **Tune comments** — discuss tunes with other logged-in users
- **Recently viewed** carousel with YouTube thumbnails
- **Admin panel** — review pending videos, edit entries, manage reports, and hide/unhide content
- **Report system** — users can report wrong timestamps, broken videos, or general issues
- **Dark/light theme** and **i18n** (English, Deutsch, Español, Français)
- **Social link previews** via Netlify Edge Functions with OpenGraph meta tags

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | SolidJS + Vite + Tailwind CSS |
| Tune database | SQLite (~11 MB) via `@sqlite.org/sqlite-wasm`, loaded client-side |
| Media database | Supabase (PostgreSQL + Storage) |
| Auth | Google OAuth via Supabase |
| Player | YouTube IFrame Player API + custom segment controls |
| Audio processing | ffmpeg.wasm (runs in an isolated iframe for COEP) |
| Deploy | Netlify (edge function for tune OpenGraph tags) |

The tune data comes from the [TheSession.org public data export](https://github.com/adactio/TheSession-data), pre-processed into a SQLite file with FTS5 search and pre-computed tune similarity scores.

---

## Running locally

```bash
npm install
# Create .env.local with your Supabase credentials:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
npm run dev
```

You'll need a Supabase project with the schema in `supabase/migrations/` applied. Key tables:

- `tune_media` — videos and user recordings
- `tune_media_entries` — tune segments inside each media item
- `tune_media_votes` — up/down votes and reports
- `tune_media_reports` — user reports for moderation
- `tune_comments` — comments on tunes
- `profiles` — public display names and avatars
- `user_roles` — admin role checks

A Supabase Storage bucket named `user-recordings` is required for audio uploads.

---

## Build quirks

- Vite `build.target` is `esnext` — required for SQLite WASM.
- `@sqlite.org/sqlite-wasm` is excluded from `optimizeDeps`.
- Dev server sets `Cross-Origin-Opener-Policy: same-origin` (required for SQLite WASM).
- `netlify.toml` sets `COOP: same-origin` globally and `COEP: credentialless` only on `/ffmpeg-worker.html`.
- Do not run `npm audit fix --force` — it would install breaking Vite 8.

---

## Data model

A single media item can contain a **set** of multiple tunes. The schema reflects this with a 1→N relationship between media and entries:

```
tune_media (1) ──── (N) tune_media_entries
                              │
                              ├── tune_id     (references the local SQLite)
                              ├── setting_id  (ABC setting, optional)
                              ├── start_sec / end_sec
                              ├── position    (order within the set)
                              ├── instruments
                              ├── key
                              └── structure
```

---

## Project structure

```
src/
  components/      # SolidJS UI components (SearchView, TuneView, AdminView, …)
  lib/             # Data access: db.js (SQLite), supabase.js (remote DB/auth)
  store/           # Global SolidJS signals and logic (appStore.js)
  i18n/            # Translations (de, en, es, fr)
  __tests__/       # Vitest tests
public/
  thesession.db    # Pre-processed SQLite (~11 MB)
netlify/
  edge-functions/  # tune-og OpenGraph injection
supabase/migrations/  # SQL schema migrations
scripts/
  extract-tunes.mjs   # Builds tunes-meta.json for the OG edge function
```

---

## Scripts

```bash
npm run dev          # Dev server (hot reload)
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run
```

---

## License

MIT
