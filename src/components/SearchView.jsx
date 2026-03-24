import { For, Show } from 'solid-js';
import { useAppStore } from '../store/appStore';
import { loginWithGoogle } from '../lib/supabase';

const TYPE_COLOR = {
  jig:        'text-[var(--color-primary)]',
  reel:       'text-blue-400',
  hornpipe:   'text-amber-400',
  polka:      'text-rose-400',
  slide:      'text-violet-400',
  waltz:      'text-cyan-400',
  march:      'text-orange-400',
  'slip jig': 'text-pink-400',
};

const TUNE_TYPES = ['jig', 'reel', 'hornpipe', 'polka', 'slide', 'waltz', 'march', 'slip jig'];

function SearchView() {
  const {
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    searchResults, selectTune,
    videoCountsByTune, videoDataReady,
    currentUser, openAddFormForTune,
  } = useAppStore();

  const isSearching = () => searchQuery().trim().length >= 2;
  const isFiltering = () => !!filterType();
  const isActive = () => isSearching() || isFiltering();

  return (
    <div class="flex flex-col items-center gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <Show when={!isActive()}>
        <div class="text-center flex flex-col items-center gap-4 py-10">
          <div class="text-6xl text-[var(--color-muted)]/30 select-none leading-none">♫</div>
          <div>
            <h2 class="text-4xl font-black text-white tracking-tight">Find any tune</h2>
            <p class="text-[var(--color-muted)] text-sm mt-2 max-w-sm leading-relaxed">
              Search 5,000+ traditional tunes and hear real performances —
              sessions, concerts, and recordings at the exact right moment.
            </p>
          </div>
        </div>
      </Show>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <Show when={videoDataReady()}>
        <p class="text-xs text-[var(--color-muted)] -mb-3">
          <span class="text-[var(--color-primary)] font-semibold">{videoCountsByTune().size}</span> tunes with videos
        </p>
      </Show>

      {/* ── Search input ─────────────────────────────────────────────── */}
      <div class="w-full max-w-xl relative">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)] select-none">♪</span>
        <input
          type="text"
          placeholder="e.g. Strayaway Child, The Morning Dew…"
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.target.value)}
          class="w-full bg-[var(--color-surface)] border border-[var(--color-primary)]/50 rounded-xl pl-10 pr-10 py-3.5 text-white placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:shadow-[0_0_20px_rgba(34,197,94,0.12)] transition-all text-sm"
          autofocus
        />
        <Show when={searchQuery().length > 0}>
          <button
            onClick={() => setSearchQuery('')}
            class="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-white transition-colors text-xs"
          >✕</button>
        </Show>
      </div>

      {/* ── Type chips ────────────────────────────────────────────────── */}
      <Show when={!isSearching()}>
        <div class="flex flex-wrap gap-2 justify-center">
          {TUNE_TYPES.map(type => {
            const active = () => filterType() === type;
            return (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType(active() ? null : type);
                }}
                class={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active()
                    ? `border-[var(--color-primary)] ${TYPE_COLOR[type] ?? 'text-white'} bg-[var(--color-primary)]/10`
                    : 'border-[var(--color-primary)]/40 text-white/70 hover:border-[var(--color-primary)] hover:text-white'
                }`}
              >
                {type}
              </button>
            );
          })}
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
                <div
                  onClick={() => selectTune(tune)}
                  class={`w-full border rounded-xl px-4 py-3 text-left transition-all group cursor-pointer
                    ${hasVideos()
                      ? 'bg-green-500/10 border-green-500/20 hover:border-[var(--color-primary)]'
                      : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-muted)]/40'
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
                            : 'text-[var(--color-muted)]'
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

                    {/* Badge de vídeos / Add button */}
                    <Show when={videoDataReady()}>
                      <Show
                        when={hasVideos()}
                        fallback={
                          <Show
                            when={currentUser()}
                            fallback={
                              <span class="text-[10px] text-[var(--color-muted)]/40 whitespace-nowrap flex-shrink-0">
                                no videos
                              </span>
                            }
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); openAddFormForTune(tune); }}
                              class="text-[10px] font-semibold whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-full border border-dashed border-[var(--color-muted)]/30 text-[var(--color-muted)]/60 hover:border-[var(--color-primary)]/60 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
                            >
                              + Add video
                            </button>
                          </Show>
                        }
                      >
                        <span class="text-[10px] font-semibold whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                          ▶ {clipCount()} {clipCount() === 1 ? 'clip' : 'clips'}
                        </span>
                      </Show>
                    </Show>
                  </div>
                </div>
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
