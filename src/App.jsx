import { onMount, Show, ErrorBoundary, createSignal } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { Moon, Sun, X } from 'lucide-solid';
import { useAppStore } from './store/appStore';
import { loginWithGoogle, logout } from './lib/supabase';
import { useI18n } from './i18n';
import AddVideoForm from './components/AddVideoForm';
import ReportForm from './components/ReportForm';
import UserRecordingsView from './components/UserRecordingsView';
import MyReports from './components/MyReports';
import RecentlyViewed from './components/RecentlyViewed';
import RecentlyAdded from './components/RecentlyAdded';
import Toast from './components/Toast';
import PublicPlaylists from './components/PublicPlaylists';

function App(props) {
  const {
    loadDB, initAuth, dbReady,
    authUser,
    showAddForm, setShowAddForm,
    addFormInitialTune, setAddFormInitialTune,
    loggingIn, setLoggingIn, showToast, pendingReviewCount,
    theme, toggleTheme,
    setSearchQuery, setFilterType, setFilterInstrument, setSelectedTune,
  } = useAppStore();

  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [generalReport, setGeneralReport] = createSignal(false);
  const [showRecordings, setShowRecordings] = createSignal(false);
  const [showMyReports, setShowMyReports] = createSignal(false);

  onMount(async () => {
    initAuth();
    await loadDB();
  });

  const isAdminPath = () => location.pathname === '/admin';

  return (
    <div class="min-h-screen flex flex-col">
      {/* Header */}
      <header class="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur">
        <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <button
            onClick={() => {
              setShowAddForm(false);
              setAddFormInitialTune(null);
              setGeneralReport(false);
              setSearchQuery('');
              setFilterType(null);
              setFilterInstrument(null);
              setSelectedTune(null);
              navigate('/');
            }}
            class="flex items-center gap-2.5 flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <div class="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
              <img src="/favicon.png" alt="TradTube" class="w-6 h-6 object-contain" />
            </div>
            <h1 class="font-black text-base tracking-tight uppercase">
              <span class="text-[var(--color-text)]">Trad</span><span class="text-[var(--color-primary)] font-light">Tube</span>
            </h1>
          </button>

          {/* Theme toggle + Lang + Auth */}
          <div class="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              class="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors p-1.5 rounded-lg"
              title={theme() === 'dark' ? t('app.switchToLight') : t('app.switchToDark')}
            >
              <Show when={theme() === 'dark'} fallback={
                <Moon size={16} />
              }>
                <Sun size={16} />
              </Show>
            </button>

            {/* Language selector */}
            <select
              value={locale()}
              onChange={(e) => setLocale(e.target.value)}
              aria-label="Language"
              class="text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-1.5 py-1 text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer appearance-none"
            >
              <option value="de">DE</option>
              <option value="en">EN</option>
              <option value="es">ES</option>
              <option value="fr">FR</option>
            </select>

          <Show
            when={authUser()}
            fallback={
              <button
                onClick={async () => {
                  setLoggingIn(true);
                  try {
                    await loginWithGoogle();
                  } catch (err) {
                    setLoggingIn(false);
                    showToast(t('login.failed'), 'error');
                  }
                }}
                disabled={loggingIn()}
                class="text-xs px-4 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors disabled:opacity-50"
              >
                {loggingIn() ? t('app.redirecting') : t('app.login')}
              </button>
            }
          >
            <div class="flex items-center gap-3">
              <button
                onClick={() => { setAddFormInitialTune(null); setShowAddForm(v => !v); }}
                class={`text-xs px-4 py-1.5 rounded-lg font-semibold transition-colors
                  ${showAddForm()
                    ? 'bg-green-400 text-black'
                    : 'bg-[var(--color-primary)] text-black hover:bg-green-400'
                  }`}
              >
                {t('app.addVideo')}
              </button>
              <button
                onClick={() => setShowRecordings(true)}
                class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors"
              >My Recordings</button>
              <button
                onClick={() => navigate('/my-submissions')}
                class={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${location.pathname === '/my-submissions'
                    ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50'
                  }`}
              >My Submissions</button>
              <button
                onClick={() => setShowMyReports(true)}
                class="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors"
              >My Reports</button>
              <Show when={authUser()?.isAdmin}>
              <button
                onClick={() => { setShowAddForm(false); navigate(isAdminPath() ? '/' : '/admin'); }}
                class={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${isAdminPath()
                    ? 'border-[var(--color-warning)]/60 bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-warning)]/30'
                  }`}
              >
                {isAdminPath() ? t('app.back') : (
                  <>
                    {t('app.admin')}
                    {pendingReviewCount() > 0 && (
                      <span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-warning)]/20 text-[var(--color-warning)] border border-[var(--color-warning)]/30 leading-none">
                        {pendingReviewCount()}
                      </span>
                    )}
                  </>
                )}
              </button>
              </Show>
              <button
                onClick={() => navigate('/playlists')}
                class={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${location.pathname.startsWith('/playlist')
                    ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/50'
                  }`}
              >
                My Playlists
              </button>
              <button
                onClick={() => navigate('/favorites')}
                class={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${location.pathname === '/favorites'
                    ? 'border-[var(--color-primary)]/50 bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-red-400 hover:border-red-400/50'
                  }`}
              >
                ♡ Favorites
              </button>
              <span class="text-xs text-[var(--color-muted)] hidden sm:inline truncate max-w-[160px]">
                {authUser()?.email}
              </span>
              <Show when={authUser()?.user_metadata?.avatar_url}>
                <img
                  src={authUser().user_metadata.avatar_url}
                  alt=""
                  class="w-6 h-6 rounded-full border border-[var(--color-border)] sm:hidden"
                />
              </Show>
              <button
                onClick={logout}
                title={t('app.logOut')}
                class="text-[var(--color-muted)] hover:text-[var(--color-error)] transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>
          </Show>
          </div>
        </div>
      </header>

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
        <Show when={dbReady()}>
          <RecentlyAdded />
        </Show>
        <RecentlyViewed />
        <PublicPlaylists />
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

      <Show when={showRecordings()}>
        <div class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 bg-black/60 overflow-y-auto">
          <div class="bg-[var(--color-surface)] rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-[var(--color-border)]">
            <UserRecordingsView onClose={() => setShowRecordings(false)} />
          </div>
        </div>
      </Show>

      <Show when={showMyReports()}>
        <MyReports onClose={() => setShowMyReports(false)} />
      </Show>

      <Toast />
    </div>
  );
}

export default App;
