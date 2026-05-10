import { onMount, Show, ErrorBoundary } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { useAppStore } from './store/appStore';
import { loginWithGoogle, logout } from './lib/supabase';
import AddVideoForm from './components/AddVideoForm';
import Toast from './components/Toast';

function App(props) {
  const {
    loadDB, initAuth, dbReady,
    currentUser,
    showAddForm, setShowAddForm,
    addFormInitialTune, setAddFormInitialTune,
    loggingIn, setLoggingIn, showToast, pendingReviewCount,
    theme, toggleTheme,
  } = useAppStore();

  const navigate = useNavigate();
  const location = useLocation();

  onMount(async () => {
    initAuth();
    await loadDB();
  });

  const isAdmin = () => location.pathname === '/admin';

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

          {/* Theme toggle + Auth */}
          <div class="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              class="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors p-1.5 rounded-lg"
              title={theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
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
          <Show
            when={currentUser()}
            fallback={
              <button
                onClick={async () => {
                  setLoggingIn(true);
                  try {
                    await loginWithGoogle();
                  } catch (err) {
                    setLoggingIn(false);
                    showToast('Login failed — please try again', 'error');
                  }
                }}
                disabled={loggingIn()}
                class="text-xs px-4 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors disabled:opacity-50"
              >
                {loggingIn() ? 'Redirecting…' : 'Login'}
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
                + Add video
              </button>
              <button
                onClick={() => { setShowAddForm(false); navigate(isAdmin() ? '/' : '/admin'); }}
                class={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${isAdmin()
                    ? 'border-[var(--color-warning)]/60 bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-warning)]/30'
                  }`}
              >
                {isAdmin() ? '← Back' : (
                  <>
                    Admin
                    {pendingReviewCount() > 0 && (
                      <span class="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-warning)]/20 text-[var(--color-warning)] border border-[var(--color-warning)]/30 leading-none">
                        {pendingReviewCount()}
                      </span>
                    )}
                  </>
                )}
              </button>
              <span class="text-xs text-[var(--color-muted)] hidden sm:inline truncate max-w-[160px]">
                {currentUser().email}
              </span>
              <button
                onClick={logout}
                class="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Log out
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
            <h2 class="text-lg font-semibold text-[var(--color-text)]">Something went wrong</h2>
            <pre class="text-xs text-[var(--color-error)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 max-w-lg overflow-auto">
              {err.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              class="text-sm px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity"
            >
              Reload page
            </button>
          </div>
        )}>
          <Show
            when={dbReady()}
            fallback={
              <div class="flex flex-col items-center justify-center py-32 gap-4">
                <div class="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                <p class="text-sm text-[var(--color-muted)]">Loading tune library…</p>
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

      <footer class="border-t border-[var(--color-border)] py-4 text-center text-xs text-[var(--color-muted)]">
        Tune data from{' '}
        <a href="https://thesession.org" target="_blank" class="underline hover:text-[var(--color-primary)]">
          TheSession.org
        </a>
      </footer>
      <Toast />
    </div>
  );
}

export default App;
