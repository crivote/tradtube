import { onMount, Show } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import { useAppStore } from './store/appStore';
import { loginWithGoogle, logout } from './lib/supabase';
import AddVideoForm from './components/AddVideoForm';

function App(props) {
  const {
    loadDB, initAuth, dbReady,
    currentUser,
    showAddForm, setShowAddForm,
    addFormInitialTune, setAddFormInitialTune,
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
        <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            class="flex items-center gap-2.5 flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <div class="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
              <img src="/favicon.png" alt="TradTube" class="w-6 h-6 object-contain" />
            </div>
            <h1 class="font-black text-base tracking-tight uppercase">
              <span class="text-white">Trad</span><span class="text-[var(--color-primary)] font-light">Tube</span>
            </h1>
          </button>

          {/* Auth */}
          <Show
            when={currentUser()}
            fallback={
              <button
                onClick={loginWithGoogle}
                class="text-xs px-4 py-1.5 rounded-lg border border-[var(--color-border)] text-white hover:border-[var(--color-primary)]/50 transition-colors"
              >
                Login
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
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-white hover:border-amber-500/30'
                  }`}
              >
                {isAdmin() ? '← Back' : 'Admin'}
              </button>
              <span class="text-xs text-[var(--color-muted)] hidden sm:inline truncate max-w-[160px]">
                {currentUser().email}
              </span>
              <button
                onClick={logout}
                class="text-xs text-[var(--color-muted)] hover:text-white transition-colors"
              >
                Log out
              </button>
            </div>
          </Show>
        </div>
      </header>

      {/* Main */}
      <main class="flex-grow max-w-4xl w-full mx-auto px-4 py-8">
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
      </main>

      <footer class="border-t border-[var(--color-border)] py-4 text-center text-xs text-[var(--color-muted)]">
        Tune data from{' '}
        <a href="https://thesession.org" target="_blank" class="underline hover:text-[var(--color-primary)]">
          TheSession.org
        </a>
      </footer>
    </div>
  );
}

export default App;
