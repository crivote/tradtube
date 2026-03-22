import { useAppStore } from '../store/appStore';

function TuneView() {
  const { selectedTune, backToSearch } = useAppStore();

  return (
    <div class="flex flex-col gap-6">
      <button
        onClick={backToSearch}
        class="flex items-center gap-2 text-sm text-[var(--color-muted)] hover:text-white transition-colors w-fit"
      >
        ← Back to search
      </button>
      <h2 class="text-2xl font-black text-white">{selectedTune()?.name}</h2>
      <p class="text-[var(--color-muted)] text-sm">
        Tune view — coming soon
      </p>
    </div>
  );
}

export default TuneView;
