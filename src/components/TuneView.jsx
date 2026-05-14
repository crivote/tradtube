/**
 * TuneView.jsx
 * Vista de detalle de una tune: reproductor + lista de entries con votos.
 */

import { Show, For, createEffect, createSignal, onCleanup } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { useAppStore } from '../store/appStore';
import { castVote, loginWithGoogle, getVideoById } from '../lib/supabase';
import { formatTime } from '../lib/utils';
import { useI18n } from '../i18n';
import YoutubePlayer from './YoutubePlayer';
import SheetMusic from './SheetMusic';
import SameTypeTunes from './SameTypeTunes';
import AddVideoForm from './AddVideoForm';

function TuneView() {
  const params = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    dbReady,
    selectedTune, tuneEntries, loadingEntries,
    activeEntry, setActiveEntry,
    currentUser, isAdmin, loadTuneById, updateEntryVote,
    getEntryVoteScore, getEntryUserVote,
    showToast, loadVideoData,
  } = useAppStore();

  // Sync selectedTune from URL param — handles both in-app nav and direct links
  createEffect(() => {
    if (dbReady()) loadTuneById(params.tuneId);
  });

  const [showSheet, setShowSheet] = createSignal(true);
  const [splitPct, setSplitPct] = createSignal(25);
  const [editingVideo, setEditingVideo] = createSignal(null);

  const handleEditVideo = async (entry) => {
    const videoId = entry.tune_videos?.id;
    if (!videoId) return;
    const video = await getVideoById(videoId);
    if (video) setEditingVideo(video);
  };

  const handleEditClose = () => {
    const was = editingVideo();
    setEditingVideo(null);
    if (was) loadVideoData();
  };

  let containerRef;
  let cleanupDrag = null;
  onCleanup(() => cleanupDrag?.());

  const startDrag = (e) => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const rect = containerRef.getBoundingClientRect();
      const pct = (clientX - rect.left) / rect.width * 100;
      setSplitPct(Math.min(Math.max(pct, 10), 70));
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      cleanupDrag = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    cleanupDrag = onUp;
  };

  const handleVote = async (e, entry, vote, isReport = false) => {
    e.stopPropagation();
    if (!currentUser()) { loginWithGoogle(); return; }
    
    const currentVote = getEntryUserVote(entry.id, entry.userVote || 0);
    const newUserVote = currentVote === vote ? 0 : vote;
    const scoreDelta = newUserVote - currentVote;
    const newScore = (getEntryVoteScore(entry.id, entry.voteScore || 0)) + scoreDelta;
    
    updateEntryVote(entry.id, newScore, newUserVote);
    
    try {
      await castVote(entry.id, vote, isReport);
      if (isReport) showToast(t('vote.reportSubmitted'), 'success');
    } catch (err) {
      updateEntryVote(entry.id, entry.voteScore, currentVote);
      showToast(t('vote.voteFailed'), 'error');
    }
  };

  const handleVideoEnd = () => {
    const entries = tuneEntries();
    const current = activeEntry();
    if (!current) return;
    const idx = entries.findIndex(e => e.id === current.id);
    if (idx !== -1 && idx < entries.length - 1) {
      setActiveEntry(entries[idx + 1]);
      setTimeout(() => {
        document.querySelector(`[data-entry-id="${entries[idx + 1].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  return (
    <Show
      when={!editingVideo()}
      fallback={<AddVideoForm editVideo={editingVideo()} onClose={handleEditClose} />}
    >
    <div class="flex flex-col gap-6">

      {/* Back */}
      <button
        onClick={() => navigate('/')}
        class="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors w-fit"
      >
        {t('tune.backToSearch')}
      </button>

      {/* Tune not found */}
      <Show when={dbReady() && !selectedTune()}>
        <div class="text-center py-16">
          <p class="text-4xl mb-4">🔍</p>
          <p class="text-xl font-semibold text-[var(--color-text)] mb-2">{t('tune.notFound')}</p>
          <p class="text-sm text-[var(--color-muted)] mb-6">{t('tune.notFoundDesc')}</p>
          <button
            onClick={() => navigate('/')}
            class="text-sm px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity"
          >
            {t('tune.backToSearchBtn')}
          </button>
        </div>
      </Show>

      <Show when={selectedTune()}>
      <div class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <h2 class="text-2xl font-black text-[var(--color-text)]">{selectedTune()?.name}</h2>
            <a
              href={`https://thesession.org/tunes/${selectedTune()?.tune_id}`}
              target="_blank"
              rel="noopener noreferrer"
              class="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors"
              title={`View ${selectedTune()?.name} on TheSession.org`}
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
          <p class="text-sm text-[var(--color-muted)] capitalize">
            {selectedTune()?.type}
            <Show when={selectedTune()?.meter}>
              {' · '}{selectedTune()?.meter}
            </Show>
            <Show when={selectedTune()?.composer}>
              {' · '}{selectedTune()?.composer}
            </Show>
          </p>
        </div>

        {/* Sheet music toggle */}
        <Show when={activeEntry()}>
          <label class="flex items-center gap-2 cursor-pointer select-none flex-shrink-0 mt-1" onClick={() => setShowSheet(v => !v)}>
            <span class="text-xs text-[var(--color-muted)]">{t('tune.sheet')}</span>
            <button
              type="button"
              class={`relative w-9 h-5 rounded-full transition-colors duration-200 focus:outline-none
                ${showSheet() ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}`}
              role="switch"
              aria-checked={showSheet() ? 'true' : 'false'}
            >
              <span class={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                ${showSheet() ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </label>
        </Show>
      </div>

      {/* Reproductor activo */}
      <Show when={activeEntry()}>
        <div ref={el => { containerRef = el; }} class="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-0">

          {/* Video panel */}
          <div style={showSheet()
            ? { flex: `0 0 ${splitPct()}%`, 'min-width': window.innerWidth >= 1024 ? '160px' : '100%' }
            : { width: '100%' }
          }
          class="lg:flex-none">
            <YoutubePlayer
              youtubeId={activeEntry()?.tune_videos?.youtube_id}
              startSec={activeEntry()?.start_sec}
              endSec={activeEntry()?.end_sec}
              autoplay={true}
              onEnd={handleVideoEnd}
            />
          </div>

          {/* Draggable divider */}
          <Show when={showSheet()}>
            <div
              onMouseDown={startDrag}
              onTouchStart={startDrag}
              class="hidden lg:flex flex-none self-stretch cursor-col-resize items-center justify-center px-3 select-none group touch-none"
              style={{"touch-action": "none"}}
            >
              <div class="flex flex-col gap-[3px] opacity-40 group-hover:opacity-100 transition-opacity">
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)] transition-colors" />
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)] transition-colors" />
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)] transition-colors" />
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)] transition-colors" />
                <div class="w-[3px] h-[3px] rounded-full bg-[var(--color-muted)] group-hover:bg-[var(--color-primary)] transition-colors" />
              </div>
            </div>

            {/* Sheet panel */}
            <div class="w-full lg:flex-1 lg:min-w-0">
              <SheetMusic
                tune={selectedTune()}
                settingId={activeEntry()?.setting_id ?? null}
              />
            </div>
          </Show>

        </div>
      </Show>

      {/* Spinner de carga */}
      <Show when={loadingEntries()}>
        <div class="flex items-center gap-3 py-8 justify-center">
          <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          <span class="text-sm text-[var(--color-muted)]">{t('tune.loadingVideos')}</span>
        </div>
      </Show>

      {/* Sin vídeos */}
      <Show when={!loadingEntries() && tuneEntries().length === 0}>
        <p class="text-[var(--color-muted)] text-sm py-4">
          {t('tune.noVideosYet')}
        </p>
      </Show>

      {/* Lista de entries */}
      <Show when={!loadingEntries() && tuneEntries().length > 0}>
        <div class="flex flex-col gap-2">
          <h3 class="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider mb-1">
            {t('tune.videos', { count: tuneEntries().length })}
          </h3>
          <For each={tuneEntries()}>
            {(entry) => {
              const isActive = () => activeEntry()?.id === entry.id;
              const startFmt = formatTime(entry.start_sec);
              const endFmt   = formatTime(entry.end_sec);
              const sourceType = entry.tune_videos?.source_type;
              const label    = sourceType ? t(`sourceTypes.${sourceType}`) ?? sourceType : t('tune.unknown');
              const entryVoteScore = () => getEntryVoteScore(entry.id, entry.voteScore || 0);
              const entryUserVote = () => getEntryUserVote(entry.id, entry.userVote || 0);

              return (
                <div
                  onClick={() => setActiveEntry(entry)}
                  data-entry-id={entry.id}
                  class={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${isActive()
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-muted)]'
                    }`}
                >
                  {/* Icono play */}
                  <div class={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs
                    ${isActive() ? 'bg-[var(--color-primary)] text-black' : 'bg-[var(--color-border)] text-[var(--color-muted)]'}`}
                  >
                    ▶
                  </div>

                  {/* Metadatos */}
                  <div class="flex-grow min-w-0 flex flex-col gap-1">
                    <Show when={entry.tune_videos?.title}>
                      <div class="flex items-center gap-1.5">
                        <span class="text-sm text-[var(--color-text)] font-medium truncate">
                          {entry.tune_videos.title}
                        </span>
                        <Show when={entry.tune_videos?.thesession_recording_id}>
                          <a
                            href={`https://thesession.org/recordings/${entry.tune_videos.thesession_recording_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors flex-shrink-0"
                            title="View recording on TheSession.org"
                            onClick={e => e.stopPropagation()}
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </Show>
                      </div>
                    </Show>
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-muted)] w-fit">
                        {label}
                      </span>
                      <Show when={entry.key}>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] w-fit font-medium">
                          {entry.key}
                        </span>
                      </Show>
                      <For each={entry.instruments ?? []}>
                        {(ins) => (
                          <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-muted)] w-fit">
                            {t(`instruments.${ins}`) ?? ins}
                          </span>
                        )}
                      </For>
                      <Show when={startFmt}>
                        <span class="text-xs text-[var(--color-muted)] font-mono">
                          {startFmt}{endFmt ? ` – ${endFmt}` : ''}
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* Admin edit */}
                  <Show when={isAdmin()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditVideo(entry); }}
                      class="text-[10px] px-2 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors flex-shrink-0"
                    >
                      Edit
                    </button>
                  </Show>

                  {/* Votos */}
                  <div class="flex items-center gap-1 lg:gap-1.5 flex-shrink-0">
                    <span class={`text-sm lg:text-base font-bold w-8 lg:w-10 text-right
                      ${entryVoteScore() > 0 ? 'text-green-400'
                        : entryVoteScore() < 0 ? 'text-[var(--color-error)]'
                        : 'text-[var(--color-muted)]'}`}
                    >
                      {entryVoteScore() > 0 ? '+' : ''}{entryVoteScore()}
                    </span>
                    <button
                      onClick={(e) => handleVote(e, entry, 1)}
                      aria-label={t('vote.upvote')}
                      class={`p-1.5 lg:p-1 transition-colors ${entryUserVote() === 1 ? 'text-green-400' : 'text-[var(--color-muted)] hover:text-green-400'}`}
                    >▲</button>
                    <button
                      onClick={(e) => handleVote(e, entry, -1)}
                      aria-label={t('vote.downvote')}
                      class={`p-1.5 lg:p-1 transition-colors ${entryUserVote() === -1 ? 'text-[var(--color-error)]' : 'text-[var(--color-muted)] hover:text-[var(--color-error)]'}`}
                    >▼</button>
                    <button
                      onClick={(e) => handleVote(e, entry, -1, true)}
                      aria-label={t('vote.report')}
                      class="p-1.5 lg:p-1 text-[var(--color-muted)] hover:text-yellow-400 transition-colors text-xs"
                    >⚑</button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
      </Show>

      {/* Más tunes del mismo tipo */}
      <Show when={selectedTune()}>
        <SameTypeTunes />
      </Show>

    </div>
    </Show>
  );
}

export default TuneView;
