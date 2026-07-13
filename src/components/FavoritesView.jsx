/**
 * FavoritesView.jsx
 * Vista de tunes favoritas del usuario autenticado.
 */

import { For, Show, createEffect, createSignal, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { ExternalLink, Play, ListPlus } from 'lucide-solid';
import { useAppStore } from '../store/appStore';
import { getFavorites } from '../lib/supabase';
import { getTuneById } from '../lib/db';
import { useI18n } from '../i18n';
import { loginWithGoogle } from '../lib/supabase';

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

function FavoritesView() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    dbReady, videoCountsByTune, videoDataReady,
    authUser, authInitialized, loggingIn, setLoggingIn,
  } = useAppStore();

  const [favorites, setFavorites] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(null);

  const loadFavorites = async () => {
    if (!dbReady()) return;
    setLoading(true);
    setError(null);
    try {
      const favs = await getFavorites();
      // Resolve tune data from SQLite for each favorite
      const resolved = favs
        .map(f => {
          const tune = getTuneById(f.tune_id);
          return tune ? { ...tune, favorited_at: f.created_at } : null;
        })
        .filter(Boolean);
      setFavorites(resolved);
    } catch (err) {
      console.error('Failed to load favorites:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    if (dbReady() && authInitialized() && authUser()) {
      loadFavorites();
    } else if (authInitialized() && !authUser()) {
      setLoading(false);
      setFavorites([]);
    }
  });

  return (
    <div class="flex flex-col gap-6">

      {/* Back */}
      <button
        onClick={() => navigate('/')}
        class="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors w-fit"
      >
        {t('tune.backToSearch')}
      </button>

      {/* Title */}
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black text-[var(--color-text)]">{t('favorites.title')}</h2>
          <p class="text-sm text-[var(--color-muted)] mt-1">{t('favorites.subtitle')}</p>
        </div>
        <Show when={favorites().length > 0}>
          <button
            onClick={() => navigate('/tune/' + favorites()[0].tune_id)}
            class="inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg font-semibold bg-[var(--color-primary)] text-black hover:opacity-90 transition-opacity flex-shrink-0 mt-1"
          >
            <Play size={14} fill="currentColor" />
            Play All
          </button>
        </Show>
      </div>

      {/* Loading */}
      <Show when={loading()}>
        <div class="flex items-center gap-3 py-8 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">{t('favorites.loading')}</span>
        </div>
      </Show>

      {/* Error */}
      <Show when={!loading() && error()}>
        <div class="text-center py-8">
          <p class="text-sm text-[var(--color-error)]">{t('favorites.error')}</p>
          <button
            onClick={loadFavorites}
            class="text-sm mt-2 underline text-[var(--color-primary)] hover:opacity-80"
          >
            {t('favorites.retry')}
          </button>
        </div>
      </Show>

      {/* Not authenticated */}
      <Show when={!loading() && authInitialized() && !authUser()}>
        <div class="flex flex-col items-center gap-3 py-6 px-6 rounded-2xl border border-[var(--color-border)] bg-white/60 dark:bg-white/5">
          <p class="text-sm text-[var(--color-text)]/90 font-medium">
            {t('favorites.loginCta')}
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

      {/* Empty state */}
      <Show when={!loading() && authUser() && favorites().length === 0}>
        <div class="text-center py-12">
          <p class="text-4xl mb-4">♡</p>
          <p class="text-lg font-semibold text-[var(--color-text)] mb-2">{t('favorites.empty')}</p>
          <p class="text-sm text-[var(--color-muted)] mb-6">{t('favorites.emptyDesc')}</p>
          <button
            onClick={() => navigate('/')}
            class="text-sm px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity"
          >
            {t('favorites.explore')}
          </button>
        </div>
      </Show>

      {/* Results */}
      <Show when={!loading() && favorites().length > 0}>
        <div class="w-full flex flex-col gap-1.5">
          <For each={favorites()}>
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

                      {/* Dot indicator */}
                      <div class={`w-2 h-2 rounded-full mt-[5px] flex-shrink-0 transition-colors
                        ${hasVideos()
                          ? 'bg-[var(--color-primary)]'
                          : videoDataReady() ? 'bg-[var(--color-border)]' : 'bg-[var(--color-border)]/50'
                        }`}
                      />

                      {/* Name + metadata */}
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
                            title={`TheSession #${tune.tune_id}`}
                          >
                            <ExternalLink size={16} />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate('/tune/' + tune.tune_id); }}
                            class="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors flex-shrink-0 leading-none"
                            title="Add to playlist"
                          >
                            <ListPlus size={14} />
                          </button>
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
                        </div>
                      </div>
                    </div>

                    {/* Video badge */}
                    <Show when={videoDataReady()}>
                      <Show when={hasVideos()} fallback={
                        <span class="text-[10px] text-[var(--color-muted)]/40 whitespace-nowrap flex-shrink-0">
                          {t('search.noVideos')}
                        </span>
                      }>
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

    </div>
  );
}

export default FavoritesView;
