import { onMount, Show, Switch, Match } from 'solid-js';
import { useAppStore } from './store/appStore';
import SearchView from './components/SearchView';
import TuneView from './components/TuneView';

function App() {
  const { loadDB, initAuth, dbReady, selectedTune, currentUser } = useAppStore();

  onMount(async () => {
    initAuth();
    await loadDB();
  });

  return (
    <div class="min-h-screen flex flex-col">
      {/* Header */}
      <header class="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur">
        <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-[var(--color-primary)] text-xl">♪</span>
            <h1 class="font-bold text-lg tracking-tight">TradTube</h1>
            <span class="text-xs text-[var(--color-muted)] hidden sm:inline">
              Traditional tunes on video
            </span>
          </div>
          <Show when={currentUser()}>
            <span class="text-xs text-[var(--color-muted)]">
              {currentUser().email}
            </span>
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
