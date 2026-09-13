import { onMount, Show, ErrorBoundary, createSignal } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { useAppStore } from './store/appStore';
import { useI18n } from './i18n';
import Header from './components/Header';
import AddVideoForm from './components/AddVideoForm';
import ReportForm from './components/ReportForm';
import RecentlyViewed from './components/RecentlyViewed';
import RecentlyAdded from './components/RecentlyAdded';
import Toast from './components/Toast';
import PublicPlaylists from './components/PublicPlaylists';

function App(props) {
  const {
    loadDB, initAuth, dbReady,
    showAddForm, setShowAddForm,
    addFormInitialTune, setAddFormInitialTune,
    showToast,
  } = useAppStore();

  const { t } = useI18n();
  const location = useLocation();
  const [generalReport, setGeneralReport] = createSignal(false);

  onMount(async () => {
    initAuth();
    await loadDB();
  });

  return (
    <div class="min-h-screen flex flex-col">
      <Header />

      {/* Main */}
      <main class="flex-grow max-w-6xl w-full mx-auto px-4 py-8">
        <ErrorBoundary fallback={(err) => (
          <div class="flex flex-col items-center justify-center py-16 gap-4">
            <div class="text-4xl">⚠</div>
            <h2 class="text-lg font-semibold text-[var(--color-text)]">{t('app.error')}</h2>
            <pre class="text-xs text-[var(--color-error)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 max-w-lg overflow-auto">
              {err.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              class="text-sm px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity"
            >
              {t('app.reload')}
            </button>
          </div>
        )}>
          <Show
            when={dbReady()}
            fallback={
              <div class="flex flex-col items-center justify-center py-32 gap-4">
                <div class="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                <p class="text-sm text-[var(--color-muted)]">{t('app.loading')}</p>
              </div>
            }
          >
            <Show
              when={showAddForm()}
              fallback={props.children}
            >
              <AddVideoForm
                initialTune={addFormInitialTune()}
                onClose={() => { setShowAddForm(false); setAddFormInitialTune(null); }}
              />
            </Show>
          </Show>
        </ErrorBoundary>
      </main>

      <Show when={location.pathname === '/'}>
        <PublicPlaylists />
        <Show when={dbReady()}>
          <RecentlyAdded />
        </Show>
        <RecentlyViewed />
      </Show>

      <div class="max-w-6xl w-full mx-auto p-4 rounded-md flex justify-center bg-[var(--color-primary)] text-white/80">
        <p class="inline-flex items-center gap-1 px-4 py-1.5 text-sm">
          {t('app.betaNotice')}{' '}
          <button
            onClick={() => setGeneralReport(true)}
            class="underline hover:text-[var(--color-primary)] transition-colors"
          >{t('app.betaLink')}</button>
        </p>
      </div>

      <Show when={generalReport()}>
        <ReportForm
          videoId={null}
          tuneId={null}
          onClose={() => setGeneralReport(false)}
        />
      </Show>

      <Toast />
    </div>
  );
}

export default App;
