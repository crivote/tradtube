import { onMount, Show, ErrorBoundary, createSignal } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { useAppStore } from './store/appStore';
import { loginWithGoogle, logout } from './lib/supabase';
import { useI18n } from './i18n';
import AddVideoForm from './components/AddVideoForm';
import ReportForm from './components/ReportForm';
import Toast from './components/Toast';

function App(props) {
  const {
    loadDB, initAuth, dbReady,
    authUser,
    showAddForm, setShowAddForm,
    addFormInitialTune, setAddFormInitialTune,
    loggingIn, setLoggingIn, showToast, pendingReviewCount,
    theme, toggleTheme,
  } = useAppStore();

  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [generalReport, setGeneralReport] = createSignal(false);

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
            onClick={() => navigate('/')}
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
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              }>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
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
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
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
        <ReportForm onClose={() => setGeneralReport(false)} />
      </Show>

      <footer class="border-t border-[var(--color-border)] py-4 text-center text-xs text-[var(--color-muted)]">
        {t('app.footer')}{' '}
        <a href="https://thesession.org" target="_blank" class="underline hover:text-[var(--color-primary)]">
          TheSession.org
        </a>
      </footer>
      <Toast />
    </div>
  );
}

export default App;
