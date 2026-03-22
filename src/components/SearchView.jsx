import { For, Show } from 'solid-js';
import { useAppStore } from '../store/appStore';

function SearchView() {
  const { searchQuery, setSearchQuery, searchResults, selectTune, dbReady } = useAppStore();

  return (
    <div class="flex flex-col items-center gap-8">
      {/* Hero */}
      <div class="text-center mt-8">
        <h2 class="text-3xl font-black text-white mb-2">Find a tune</h2>
        <p class="text-[var(--color-muted)] text-sm">
          Search by name or alias — hear real performances from sessions, concerts and TV
        </p>
      </div>

      {/* Search input */}
      <div class="w-full max-w-xl relative">
        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">♪</span>
        <input
          type="text"
          placeholder="e.g. Strayaway Child, The Morning Dew…"
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.target.value)}
          class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors text-sm"
          autofocus
        />
        <Show when={searchQuery().length > 0}>
          <button
            onClick={() => setSearchQuery('')}
            class="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-white transition-colors"
          >
            ✕
          </button>
        </Show>
      </div>

      {/* Resultados */}
      <Show when={searchResults().length > 0}>
        <div class="w-full max-w-xl flex flex-col gap-2">
          <For each={searchResults()}>
            {(tune) => (
              <button
                onClick={() => selectTune(tune)}
                class="w-full bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] rounded-xl px-4 py-3 text-left transition-all group"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <span class="font-semibold text-white group-hover:text-[var(--color-primary)] transition-colors">
                      {tune.name}
                    </span>
                    <div class="flex items-center gap-2 mt-0.5">
                      <span class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)]/70">
                        {tune.type}
                      </span>
                      <span class="text-[10px] text-[var(--color-muted)]">{tune.meter}</span>
                    </div>
                  </div>
                  <span class="text-[10px] text-[var(--color-muted)] whitespace-nowrap">
                    {tune.tunebooks} books
                  </span>
                </div>
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Empty state */}
      <Show when={searchQuery().length >= 2 && searchResults().length === 0}>
        <p class="text-[var(--color-muted)] text-sm">No tunes found for "{searchQuery()}"</p>
      </Show>
    </div>
  );
}

export default SearchView;
