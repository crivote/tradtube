import { For, Show } from 'solid-js';
import { useAppStore } from '../store/appStore';

const TYPE_COLOR = {
  jig:        'text-[var(--color-primary)]',
  reel:       'text-blue-400',
  hornpipe:   'text-amber-400',
  polka:      'text-rose-400',
  slide:      'text-violet-400',
  waltz:      'text-cyan-400',
  march:      'text-orange-400',
  strathspey: 'text-yellow-400',
};

const TUNE_TYPES = ['jig', 'reel', 'hornpipe', 'polka', 'slide', 'waltz', 'march', 'strathspey'];

function SearchView() {
  const {
    searchQuery, setSearchQuery,
    searchResults, selectTune,
    videoCountsByTune, videoDataReady,
  } = useAppStore();

  const isSearching = () => searchQuery().trim().length >= 2;

  return (
    <div class="flex flex-col items-center gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <Show when={!isSearching()}>
        <div class="text-center flex flex-col items-center gap-4 py-10">
          <div class="w-16 h-16 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-3xl select-none">
            ♪
          </div>
          <div>
            <h2 class="text-4xl font-black text-white tracking-tight">Find any tune</h2>
            <p class="text-[var(--color-muted)] text-sm mt-2 max-w-sm leading-relaxed">
              Search 5,000+ traditional tunes and hear real performances —
              sessions, concerts, and recordings at the exact right moment.
            </p>
          </div>
        </div>
      </Show>

      {/* ── Search input ─────────────────────────────────────────────── */}
      <div class="w-full max-w-xl relative">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)] select-none">♪</span>
        <input
          type="text"
          placeholder="e.g. Strayaway Child, The Morning Dew…"
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.target.value)}
          class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl pl-10 pr-10 py-3.5 text-white placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
          autofocus
        />
        <Show when={searchQuery().length > 0}>
          <button
            onClick={() => setSearchQuery('')}
            class="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-white transition-colors text-xs"
          >✕</button>
        </Show>
      </div>

      {/* ── Type chips (idle) ─────────────────────────────────────────── */}
      <Show when={!isSearching()}>
        <div class="flex flex-wrap gap-2 justify-center">
          {TUNE_TYPES.map(type => (
            <button
              onClick={() => setSearchQuery(type)}
              class={`text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40 transition-colors ${TYPE_COLOR[type] ?? 'text-[var(--color-muted)]'}`}
            >
              {type}
            </button>
          ))}
        </div>
      </Show>

      {/* ── Results ───────────────────────────────────────────────────── */}
      <Show when={searchResults().length > 0}>
        <div class="w-full max-w-xl flex flex-col gap-1.5">
          <For each={searchResults()}>
            {(tune) => {
              const clipCount = () => videoCountsByTune().get(tune.tune_id) ?? 0;
              const hasVideos = () => videoDataReady() && clipCount() > 0;
              const typeColor = TYPE_COLOR[tune.type] ?? 'text-[var(--color-muted)]';

              return (
                <button
                  onClick={() => selectTune(tune)}
                  class={`w-full bg-[var(--color-surface)] border rounded-xl px-4 py-3 text-left transition-all group
                    ${hasVideos()
                      ? 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-muted)]/40'
                    }`}
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-start gap-2.5 min-w-0">

                      {/* Dot indicador */}
                      <div class={`w-2 h-2 rounded-full mt-[5px] flex-shrink-0 transition-colors
                        ${hasVideos()
                          ? 'bg-[var(--color-primary)]'
                          : videoDataReady() ? 'bg-[var(--color-border)]' : 'bg-[var(--color-border)]/50'
                        }`}
                      />

                      {/* Nombre + metadatos */}
                      <div class="min-w-0">
                        <span class={`font-semibold block leading-snug truncate transition-colors
                          ${hasVideos()
                            ? 'text-white group-hover:text-[var(--color-primary)]'
                            : 'text-[var(--color-muted)] group-hover:text-white'
                          }`}
                        >
                          {tune.name}
                        </span>
                        <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span class={`text-[10px] font-bold uppercase tracking-widest ${typeColor}`}>
                            {tune.type}
                          </span>
                          <Show when={tune.meter}>
                            <span class="text-[10px] text-[var(--color-border)]">·</span>
                            <span class="text-[10px] text-[var(--color-muted)]">{tune.meter}</span>
                          </Show>
                          <span class="text-[10px] text-[var(--color-border)]">·</span>
                          <span class="text-[10px] text-[var(--color-muted)]">{tune.tunebooks} books</span>
                        </div>
                      </div>
                    </div>

                    {/* Badge de vídeos */}
                    <Show when={videoDataReady()}>
                      <Show
                        when={hasVideos()}
                        fallback={
                          <span class="text-[10px] text-[var(--color-muted)]/40 whitespace-nowrap flex-shrink-0">
                            no videos
                          </span>
                        }
                      >
                        <span class="text-[10px] font-semibold whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                          ▶ {clipCount()} {clipCount() === 1 ? 'clip' : 'clips'}
                        </span>
                      </Show>
                    </Show>
                  </div>
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* ── Empty state ───────────────────────────────────────────────── */}
      <Show when={isSearching() && searchResults().length === 0}>
        <div class="text-center py-8">
          <p class="text-[var(--color-muted)] text-sm">
            No tunes found for "<span class="text-white">{searchQuery()}</span>"
          </p>
          <p class="text-[var(--color-muted)] text-xs mt-1">Try a different spelling or alias</p>
        </div>
      </Show>

    </div>
  );
}

export default SearchView;
