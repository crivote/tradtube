import { For } from 'solid-js';
import { useAppStore } from '../store/appStore';

const TYPE_STYLE = {
  success: 'border-green-500/40 bg-green-500/10 text-green-400',
  error:   'border-[var(--color-error)]/40 bg-[var(--color-error)]/10 text-[var(--color-error)]',
  info:    'border-blue-400/40 bg-blue-400/10 text-blue-400',
  warning: 'border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
};

export default function Toast() {
  const { toasts, dismissToast } = useAppStore();

  return (
    <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <For each={toasts()}>
        {(t) => (
          <div
            class={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur text-sm
              animate-[toast-in_0.25s_ease-out] ${TYPE_STYLE[t.type] || TYPE_STYLE.info}`}
            style={{"animation-fill-mode": "forwards"}}
          >
            <span class="flex-grow">{t.message}</span>
            {t.action && (
              <button
                onClick={() => { t.action.onClick(); dismissToast(t.id); }}
                class="font-semibold hover:underline flex-shrink-0"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => dismissToast(t.id)}
              class="opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
            >
              ✕
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
