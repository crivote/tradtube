# TradTube

> Find real YouTube performances for any traditional tune — with exact timestamps.

TradTube connects [TheSession.org](https://thesession.org) tune catalogue with curated YouTube clips. Search for a tune by name and get real performances ready to play, with start/end timestamps that handle sets correctly (e.g. a tune that starts at 3:47 in a longer video).

**Built for:** folk and traditional musicians who want to hear authentic performances of a tune to learn, practice, or play along.

---

## The problem it solves

TheSession is the canonical reference for tune names, ABC notation, and settings — but the MIDI it generates doesn't capture real phrasing, ornamentation, or rhythm. YouTube has thousands of sessions, concerts, and tutorials, but no structure linking them to specific tunes, and no way to handle sets where the tune you want starts three minutes in.

TradTube bridges both: structured tune data + video clips with precise timestamps.

---

## Features

- **Fuzzy search** across ~5,000 popular tunes (FTS5, runs entirely in the browser)
- **YouTube player** with exact start/end timestamps — essential for sets
- **Curated entries** with source type badges (studio, session, tutorial, live…)
- **Community voting** — upvote/downvote/report entries (Google login)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | SolidJS + Vite + Tailwind CSS |
| Tune database | SQLite (~11MB) via `@sqlite.org/sqlite-wasm`, loaded client-side |
| Video database | Supabase (PostgreSQL) |
| Auth | Google OAuth via Supabase |
| Player | YouTube IFrame Player API |
| Deploy | Netlify |

The tune data comes from the [TheSession.org public data export](https://github.com/adactio/TheSession-data), pre-processed into a SQLite file with FTS5 search and pre-computed tune similarity scores.

---

## Running locally

```bash
npm install
cp .env.example .env.local   # add your Supabase URL and anon key
npm run dev
```

You'll need a Supabase project with the following tables: `tune_videos`, `tune_video_entries`, `tune_video_votes`.

---

## Data model

A single YouTube video can contain a **set** of multiple tunes. The schema reflects this with a 1→N relationship between videos and entries:

```
tune_videos (1) ──── (N) tune_video_entries
                              │
                              ├── tune_id     (references the local SQLite)
                              ├── start_sec / end_sec
                              └── position    (order within the set)
```

---

## License

MIT
