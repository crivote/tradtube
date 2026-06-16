import { For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { ExternalLink } from 'lucide-solid';
import { useAppStore } from '../store/appStore';
import { loginWithGoogle } from '../lib/supabase';
import { getRecentlyViewed } from '../lib/recentlyViewed';
import { useI18n } from '../i18n';
import { INSTRUMENT_KEYS } from '../constants';

const TYPE_COLOR = {
  jig:        'text-[var(--color-primary)]',
  reel:       'text-blue-400',
  hornpipe:   'text-[var(--color-warning)]',
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
    filterInstrument, setFilterInstrument,
    searchResults,
    videoCountsByTune, videoDataReady,
    placeholderExamples, typeCounts,
    authUser, authInitialized, loggingIn, setLoggingIn, openAddFormForTune,
  } = useAppStore();

  const { t } = useI18n();

  const placeholder = () => {
    const examples = placeholderExamples();
    if (examples.length === 2) {
      return t('search.placeholderExamples', { name1: examples[0], name2: examples[1] });
    }
    return t('search.placeholder');
  };

  const recentlyViewed = () => getRecentlyViewed();

  const navigate = useNavigate();

  const isSearching = () => searchQuery().trim().length >= 2;
  const isFiltering = () => !!filterType() || !!filterInstrument();
  const isActive = () => isSearching() || isFiltering();

  const instrumentLabel = (key) => t(`instruments.${key}`);

  return (
    <div class="flex flex-col items-center gap-6">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <Show when={!isActive()}>
        <div class="text-center flex flex-col items-center gap-4 py-10">
          <img src="/favicon.png" alt="" class="w-44 h-44" />
          <div>
            <h2 class="text-4xl font-black text-[var(--color-text)] tracking-tight">{t('search.heroTitle')}</h2>
            <p class="text-[var(--color-muted)] text-sm mt-2 leading-relaxed mx-auto">
              {t('search.heroSubtitle')}
            </p>
            <Show when={authInitialized() && !authUser()}>
              <div class="flex flex-col items-center gap-3 mt-6 p-6 rounded-2xl border border-[var(--color-border)] bg-white/60 dark:bg-white/5">
                <p class="text-sm text-[var(--color-text)]/90 font-medium">
                  {t('search.heroCta')}
                </p>
                <button
                  onClick={async () => {
                    setLoggingIn(true);
                    try { await loginWithGoogle(); }
                    catch (err) { setLoggingIn(false); }
                  }}
                  disabled={loggingIn()}
                  class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--color-primary)]/40 text-[var(--color-primary)] font-semibold text-sm hover:bg-[var(--color-primary)]/10 transition-colors disabled:opacity-50"
                >
                  <svg class="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {loggingIn() ? t('app.redirecting') : t('search.heroCtaButton')}
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* ── Recently viewed ────────────────────────────────────────────── */}
      <Show when={recentlyViewed().length > 0}>
        <div class="w-full max-w-xl flex flex-col gap-1.5">
          <p class="text-xs text-[var(--color-muted)] font-semibold uppercase tracking-wider">{t('search.recentlyViewed')}</p>
          <div class="flex flex-wrap gap-2">
            <For each={recentlyViewed()}>
              {(tune) => (
                <button
                  onClick={() => navigate('/tune/' + tune.tune_id)}
                  class="text-xs px-3 py-1.5 rounded-full border border-[var(--color-primary)]/40 text-[var(--color-text)]/70 hover:border-[var(--color-primary)] hover:text-[var(--color-text)] transition-colors bg-[var(--color-surface)]"
                >
                  {tune.name}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <Show when={videoDataReady()}>
        <p class="text-xs text-[var(--color-muted)] -mb-3">
          <span class="text-[var(--color-primary)] font-semibold">{videoCountsByTune().size}</span>{' '}
          {t('search.tunesWithVideos')}
        </p>
      </Show>

      {/* ── Search input + Instrument filter ─────────────────────────── */}
      <div class="w-full max-w-xl flex gap-2">
        <div class="flex-1 relative">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)] select-none">♪</span>
          <input
            type="text"
            placeholder={placeholder()}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.target.value)}
            aria-label="Search tunes"
            role="searchbox"
            class="w-full bg-[var(--color-surface)] border border-[var(--color-primary)]/50 rounded-xl pl-10 pr-10 py-3.5 text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:shadow-[0_0_20px_rgba(34,197,94,0.12)] transition-all text-sm"
            autofocus
          />
          <Show when={searchQuery().length > 0}>
            <button
              onClick={() => setSearchQuery('')}
              class="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors text-xs"
            >✕</button>
          </Show>
        </div>
        <select
          value={filterInstrument() ?? ''}
          onChange={(e) => setFilterInstrument(e.target.value || null)}
          aria-label="Filter by instrument"
          class="bg-[var(--color-surface)] border border-[var(--color-primary)]/50 rounded-xl px-3 py-3.5 text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)] cursor-pointer flex-shrink-0"
        >
          <option value="">{t('search.any')}</option>
          <For each={INSTRUMENT_KEYS}>
            {(key) => <option value={key}>{instrumentLabel(key)}</option>}
          </For>
        </select>
      </div>

      {/* ── Type chips ────────────────────────────────────────────────── */}
        <div class="flex flex-wrap gap-2 justify-center">
          {TUNE_TYPES.map(type => {
            const active = () => filterType() === type;
            const counts = () => typeCounts()[type];
            const label = () => counts() ? `${type} ${counts().withVideos}` : type;
            return (
              <button
                onClick={() => {
                  setFilterType(active() ? null : type);
                }}
                aria-pressed={active()}
                class={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active()
                    ? `border-[var(--color-primary)] ${TYPE_COLOR[type] ?? 'text-[var(--color-text)]'} bg-[var(--color-primary)]/10`
                    : 'border-[var(--color-primary)]/40 text-[var(--color-text)]/70 hover:border-[var(--color-primary)] hover:text-[var(--color-text)]'
                }`}
              >
                {label()}
              </button>
            );
          })}
        </div>

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
                  onClick={() => navigate('/tune/' + tune.tune_id)}
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
                        <div class="flex items-center gap-1.5">
                          <span class={`font-semibold leading-snug truncate transition-colors
                            ${hasVideos()
                              ? 'text-[var(--color-text)] group-hover:text-[var(--color-primary)]'
                              : 'text-[var(--color-muted)]'
                            }`}
                          >
                            {tune.name}
                          </span>
                          <a
                            href={`https://thesession.org/tunes/${tune.tune_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            class="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors flex-shrink-0 leading-none"
                            title={`TheSession #${tune.tune_id}${tune.composer ? ` · ${tune.composer}` : ''}`}
                          >
                            <ExternalLink size={16} />
                          </a>
                        </div>
                        <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span class={`text-[10px] font-bold uppercase tracking-widest ${typeColor}`}>
                            {tune.type}
                          </span>
                          <Show when={tune.meter}>
                            <span class="text-[10px] text-[var(--color-border)]">·</span>
                            <span class="text-[10px] text-[var(--color-muted)]">{tune.meter}</span>
                          </Show>
                          <Show when={tune.composer}>
                            <span class="text-[10px] text-[var(--color-border)]">·</span>
                            <span class="text-[10px] text-[var(--color-muted)]">{tune.composer}</span>
                          </Show>
                          <span class="text-[10px] text-[var(--color-border)]">·</span>
                          <span class="text-[10px] text-[var(--color-muted)]">{tune.tunebooks} {t('search.books')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Badge de vídeos / Add button */}
                    <Show when={videoDataReady()}>
                      <Show
                        when={hasVideos()}
                        fallback={
                          <Show
                              when={authUser()}
                            fallback={
                              <span class="text-[10px] text-[var(--color-muted)]/40 whitespace-nowrap flex-shrink-0">
                                {t('search.noVideos')}
                              </span>
                            }
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); openAddFormForTune(tune); }}
                              class="text-[10px] font-semibold whitespace-nowrap flex-shrink-0 px-2.5 py-1 rounded-full border border-dashed border-[var(--color-muted)]/30 text-[var(--color-muted)]/60 hover:border-[var(--color-primary)]/60 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
                            >
                              {t('search.addVideo')}
                            </button>
                          </Show>
                        }
                      >
                        <span class="text-[10px] font-semibold whitespace-nowrap flex-shrink-0 px-2 py-0.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)]">
                          ♫ {clipCount()} {clipCount() === 1 ? t('search.clip') : t('search.clips')}
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

      {/* ── Empty state: text search ──────────────────────────────────── */}
      <Show when={isSearching() && searchResults().length === 0}>
        <div class="text-center py-8">
          <p class="text-[var(--color-muted)] text-sm">
            {t('search.noTunesFound', { query: searchQuery() })}
          </p>
          <p class="text-[var(--color-muted)] text-xs mt-1">{t('search.tryDifferent')}</p>
        </div>
      </Show>

      {/* ── Empty state: type/instrument filter ────────────────────────── */}
      <Show when={isFiltering() && !isSearching() && searchResults().length === 0 && videoDataReady()}>
        <div class="text-center py-8">
          <p class="text-[var(--color-muted)] text-sm">
            {t('search.noTunesVideos', { filter: [
              filterType() ? TUNE_TYPES.find(t => t === filterType()) || filterType() : '',
              filterType() && filterInstrument() ? ' · ' : '',
              filterInstrument() ? instrumentLabel(filterInstrument()) : '',
            ].join('') })}
          </p>
          <Show when={authUser()}>
            <p class="text-[var(--color-muted)] text-xs mt-1">
              {t('search.knowGoodVideo')}{' '}
              <button onClick={() => setSearchQuery('')} class="underline hover:text-[var(--color-primary)]">{t('search.searchAndAdd')}</button>{' '}
              {t('search.andAdd')}
            </p>
          </Show>
        </div>
      </Show>

    </div>
  );
}

export default SearchView;
