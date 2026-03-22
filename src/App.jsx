import { onMount, Show, Switch, Match } from 'solid-js';
import { useAppStore } from './store/appStore';
import { loginWithGoogle, logout } from './lib/supabase';
import SearchView from './components/SearchView';
import TuneView from './components/TuneView';
import AddVideoForm from './components/AddVideoForm';

function App() {
  const {
    loadDB, initAuth, dbReady,
    selectedTune, currentUser,
    showAddForm, setShowAddForm,
  } = useAppStore();

  onMount(async () => {
    initAuth();
    await loadDB();
  });

  return (
    <div class="min-h-screen flex flex-col">
      {/* Header */}
      <header class="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur">
        <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <div class="flex items-center gap-2 flex-shrink-0">
            <span class="text-[var(--color-primary)] text-xl">♪</span>
            <h1 class="font-bold text-lg tracking-tight">TradTube</h1>
            <span class="text-xs text-[var(--color-muted)] hidden sm:inline">
              Traditional tunes on video
            </span>
          </div>

          {/* Auth */}
          <Show
            when={currentUser()}
            fallback={
              <button
                onClick={loginWithGoogle}
                class="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-white hover:border-[var(--color-primary)]/50 transition-colors"
              >
                Sign in with Google
              </button>
            }
          >
            <div class="flex items-center gap-3">
              <button
                onClick={() => setShowAddForm(v => !v)}
                class={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${showAddForm()
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-white hover:border-[var(--color-primary)]/50'
                  }`}
              >
                + Add video
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
          <Switch>
            <Match when={showAddForm()}>
              <AddVideoForm onClose={() => setShowAddForm(false)} />
            </Match>
            <Match when={!selectedTune()}>
              <SearchView />
            </Match>
            <Match when={selectedTune()}>
              <TuneView />
            </Match>
          </Switch>
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
