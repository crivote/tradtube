# TradTube — Agent Instructions

> For full architecture and schema, see **CLAUDE.md**. For data model internals, see **INTERNAL.md** (gitignored).

## Framework: SolidJS, NOT React

This is a **SolidJS** project. React idioms will break. Key differences:
- Signals are **functions**: `tune()`, not `tune`. Always call signals to read/write.
- Components from `solid-js`: `createSignal`, `createEffect`, `Show`, `For`, `Switch/Match`.
- Event handlers use `onClick`, `onInput` — not `onChange`.
- No `useState`, `useEffect`, `useMemo`. Use `createSignal`, `createEffect`, `createMemo`.

## Commands

```bash
npm run dev          # Dev server (hot reload)
npm run build        # Production build → dist/
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run
```

Tests live in `src/__tests__/` and use `vitest` with `globals: true` (no imports needed for `describe`/`it`/`expect`).

No lint or typecheck scripts are configured. Do not add them without asking.

## Build quirks

- Vite `build.target` is `esnext` — required for SQLite WASM.
- `@sqlite.org/sqlite-wasm` is excluded from `optimizeDeps` (vite.config.js).
- Dev server sets `Cross-Origin-Opener-Policy: same-origin` header (required for SQLite WASM).
- `netlify.toml` headers must NOT be touched — they handle COOP for production and SPA routing.
- `.npmrc` sets `audit=false`. Do NOT run `npm audit fix --force` — it would install breaking Vite 8.

## Do NOT touch

| File | Reason |
|---|---|
| `public/thesession.db` | Pre-processed SQLite (~11MB), do not regenerate |
| `.env.local` | Contains Supabase keys, gitignored |
| `netlify.toml` | Headers and SPA redirects are correctly configured |

## Conventions

- **Components** in `src/components/`, **logic** in `src/lib/` and `src/store/`.
- **CSS**: Use Tailwind utility classes only. Theme colors defined as CSS variables in `src/index.css` (`--color-bg`, `--color-surface`, `--color-green`, `--color-amber`, etc).
- **Supabase client** is initialized in `src/lib/supabase.js`, not in constants (constants only stores `SUPABASE_URL` and `SUPABASE_ANON_KEY`).
- **SQLite** access is in `src/lib/db.js` — `initDB()` must be called before any queries.
- **Global state** in `src/store/appStore.js` via SolidJS signals.
- **Supabase migrations** in `supabase/migrations/` — apply with Supabase CLI or MCP.

## Routes

```
/                    SearchView
/tune/:tuneId        TuneView
/admin               AdminView
```

## Auth

Google OAuth via Supabase. User role check: `getUserRole(userId)` in `src/lib/supabase.js`. User profile stored in `public.user_roles` table with `role` column.

## No CI/CD

No GitHub Actions or other CI workflows exist. Testing is manual.
