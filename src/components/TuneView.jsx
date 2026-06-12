/**
 * TuneView.jsx
 * Vista de detalle de una tune: reproductor + lista de entries con votos.
 */

import { Show, For, createEffect, createSignal, onCleanup } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { ExternalLink, Mic, ThumbsUp } from 'lucide-solid';
import { useAppStore } from '../store/appStore';
import { castVote, loginWithGoogle, getVideoById } from '../lib/supabase';
import { formatTime, extractYoutubeId } from '../lib/utils';
import { useI18n } from '../i18n';
import YoutubePlayer from './YoutubePlayer';
import SheetMusic from './SheetMusic';
import SameTypeTunes from './SameTypeTunes';
import AddVideoForm from './AddVideoForm';
import AddRecordingFlow from './AddRecordingFlow';
import AudioPlayer from './AudioPlayer';
import ReportForm from './ReportForm';

function TuneView() {
  const params = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    dbReady,
    selectedTune, tuneEntries, loadingEntries,
    activeEntry, setActiveEntry,
    authUser, authInitialized, loggingIn, setLoggingIn, loadTuneById, updateEntryVote,
    getEntryVoteScore, getEntryUserVote,
    showToast, loadVideoData, openAddFormForTune,
  } = useAppStore();

  // Sync selectedTune from URL param — handles both in-app nav and direct links
  createEffect(() => {
    if (dbReady()) loadTuneById(params.tuneId);
  });

  const [showSheet, setShowSheet] = createSignal(true);
  const [splitPct, setSplitPct] = createSignal(25);
  const [editingVideo, setEditingVideo] = createSignal(null);
  const [reportingEntry, setReportingEntry] = createSignal(null);
  const [showRecordingFlow, setShowRecordingFlow] = createSignal(false);
  const [mediaTab, setMediaTab] = createSignal('videos');

  const handleEditVideo = async (entry) => {
    const videoId = entry.tune_media?.id;
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

  const handleVote = async (e, entry) => {
    e.stopPropagation();
    if (!authUser()) { loginWithGoogle(); return; }

    const currentVote = getEntryUserVote(entry.id, entry.userVote || 0);
    const newUserVote = currentVote === 1 ? 0 : 1;
    const scoreDelta = newUserVote - currentVote;
    const newScore = (getEntryVoteScore(entry.id, entry.voteScore || 0)) + scoreDelta;

    updateEntryVote(entry.id, newScore, newUserVote);

    try {
      await castVote(entry.id, newUserVote);
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
              <ExternalLink size={20} />
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

        {/* Sheet music toggle + Record */}
        <div class="flex items-center gap-3 flex-shrink-0 mt-1">
          <Show when={authUser()}>
            <button
              onClick={() => setShowRecordingFlow(true)}
              class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20 transition-colors font-semibold"
            >
              <Mic size={14} />
              Record
            </button>
          </Show>
          <label class="flex items-center gap-2 cursor-pointer select-none" onClick={() => setShowSheet(v => !v)}>
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
      </div>
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
            <Show
              when={activeEntry()?.tune_media?.source_type === 'user_recording'}
              fallback={
                <YoutubePlayer
                  youtubeId={extractYoutubeId(activeEntry()?.tune_media?.media_uri)}
                  startSec={activeEntry()?.start_sec}
                  endSec={activeEntry()?.end_sec}
                  autoplay={true}
                  onEnd={handleVideoEnd}
                />
              }
            >
              <div class="rounded-xl overflow-hidden border border-[var(--color-border)] bg-black flex items-center justify-center p-4 aspect-video">
                <AudioPlayer
                  mediaUri={activeEntry()?.tune_media?.media_uri}
                  startSec={activeEntry()?.start_sec}
                  endSec={activeEntry()?.end_sec}
                  autoplay={true}
                  onEnd={handleVideoEnd}
                  performerName={activeEntry()?.tune_media?.performer_name}
                  notes={activeEntry()?.tune_media?.recording_notes}
                />
              </div>
            </Show>
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

      {/* Sheet full-width when no video active */}
      <Show when={!activeEntry() && showSheet()}>
        <div class="w-full">
          <SheetMusic
            tune={selectedTune()}
            settingId={null}
          />
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
        <Show when={authInitialized()}>
          <Show
            when={authUser()}
            fallback={
              <div class="flex flex-col items-center gap-3 py-6 px-6 rounded-2xl border border-[var(--color-border)] bg-white/60 dark:bg-white/5">
                <p class="text-sm text-[var(--color-text)]/90 font-medium">
                  {t('tune.loginToAddCta')}
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
            }
          >
            <div class="flex flex-col items-center gap-3 py-6 px-6 rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5">
              <p class="text-[var(--color-text)]/80 text-sm">
                {t('tune.noVideosYet')}
              </p>
              <button
                onClick={() => openAddFormForTune(selectedTune())}
                class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--color-primary)] text-white font-semibold text-sm hover:bg-[var(--color-primary)]/90 transition-colors shadow-sm"
              >
                <span class="text-base leading-none">+</span>
                {t('tune.addVideoCta')}
              </button>
            </div>
          </Show>
        </Show>
      </Show>

      {/* Lista de entries con tabs */}
      <Show when={!loadingEntries() && tuneEntries().length > 0}>
        <div class="flex flex-col gap-2">
          {/* Tabs */}
          <div class="flex gap-1 border-b border-[var(--color-border)] pb-0 mb-1">
            <button
              onClick={() => setMediaTab('videos')}
              class={`text-xs px-4 py-2 -mb-px border-b-2 transition-colors font-semibold
                ${mediaTab() === 'videos'
                  ? 'border-[var(--color-primary)] text-[var(--color-text)]'
                  : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
            >
              Videos{() => {
                const c = tuneEntries().filter(e => e.tune_media?.source_type !== 'user_recording').length;
                return c > 0 ? ` (${c})` : '';
              }}
            </button>
            <button
              onClick={() => setMediaTab('recordings')}
              class={`text-xs px-4 py-2 -mb-px border-b-2 transition-colors font-semibold
                ${mediaTab() === 'recordings'
                  ? 'border-[var(--color-primary)] text-[var(--color-text)]'
                  : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'}`}
            >
              Recordings{() => {
                const c = tuneEntries().filter(e => e.tune_media?.source_type === 'user_recording').length;
                return c > 0 ? ` (${c})` : '';
              }}
            </button>
          </div>

          <For each={tuneEntries().filter(e => mediaTab() === 'videos'
            ? e.tune_media?.source_type !== 'user_recording'
            : e.tune_media?.source_type === 'user_recording'
          )}>
            {(entry) => {
              const isActive = () => activeEntry()?.id === entry.id;
              const startFmt = formatTime(entry.start_sec);
              const endFmt   = formatTime(entry.end_sec);
              const sourceType = entry.tune_media?.source_type;
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
                    <Show when={entry.tune_media?.title}>
                      <div class="flex items-center gap-1.5">
                        <span class="text-sm text-[var(--color-text)] font-medium truncate">
                          {entry.tune_media.title}
                        </span>
                        <Show when={entry.tune_media?.thesession_recording_id}>
                          <a
                            href={`https://thesession.org/recordings/${entry.tune_media.thesession_recording_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors flex-shrink-0"
                            title="View recording on TheSession.org"
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink size={16} />
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
                      <Show when={entry.structure}>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-muted)] w-fit font-mono">
                          {entry.structure}
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
                  <Show when={authUser()?.isAdmin}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEditVideo(entry); }}
                      class="text-[10px] px-2 py-1 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors flex-shrink-0"
                    >
                      Edit
                    </button>
                  </Show>

                  {/* Votos */}
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <Show when={entryVoteScore() !== 0}>
                      <span class="text-xs text-[var(--color-muted)] font-medium mr-0.5">
                        {entryVoteScore()} {t('vote.votes')}
                      </span>
                    </Show>
                    <button
                      onClick={(e) => handleVote(e, entry)}
                      aria-label={t('vote.upvote')}
                      class={`p-1.5 transition-colors ${entryUserVote() === 1 ? 'text-green-400' : 'text-[var(--color-muted)] hover:text-green-400'}`}
                    >
                      <ThumbsUp size={16} fill={entryUserVote() === 1 ? 'currentColor' : 'none'} stroke-width="1.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReportingEntry(entry); }}
                      aria-label={t('report.title')}
                      class="p-1.5 text-red-400/60 hover:text-red-400 transition-colors text-base"
                      title={t('report.title')}
                    >⚠</button>
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

      <Show when={reportingEntry()}>
        <ReportForm
          videoId={reportingEntry().tune_media?.id}
          tuneId={reportingEntry().tune_id}
          onClose={() => setReportingEntry(null)}
        />
      </Show>

      <Show when={showRecordingFlow()}>
        <AddRecordingFlow
          initialTune={selectedTune()}
          onClose={() => setShowRecordingFlow(false)}
        />
      </Show>

    </div>
    </Show>
  );
}

export default TuneView;
