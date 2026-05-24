import { createSignal, onMount, For, Show } from 'solid-js';
import { getMyReports } from '../lib/supabase';
import { extractYoutubeId } from '../lib/utils';
import { useI18n } from '../i18n';

const STATUS_STYLE = {
  pending:   'text-[var(--color-warning)] border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10',
  tracking:  'text-blue-400 border-blue-400/30 bg-blue-400/10',
  solved:    'text-green-400 border-green-400/30 bg-green-400/10',
  discarded: 'text-[var(--color-error)] border-[var(--color-error)]/30 bg-[var(--color-error)]/10',
};

export default function MyReports(props) {
  const { t } = useI18n();
  const [reports, setReports] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const data = await getMyReports();
      setReports(data);
    } finally {
      setLoading(false);
    }
  });

  const reportTypeLabel = (type) => t(`report.types.${type}`) ?? type;
  const reportStatusLabel = (status) => t(`report.status.${status}`) ?? status;
  const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 bg-black/60 overflow-y-auto" onClick={() => props.onClose()}>
      <div
        class="bg-[var(--color-surface)] rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between mb-5">
          <h3 class="text-lg font-bold text-[var(--color-text)]">{t('myReports.title')}</h3>
          <button
            onClick={() => props.onClose()}
            class="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors text-sm"
          >{t('report.close')}</button>
        </div>

        <Show when={loading()}>
          <div class="flex items-center gap-3 py-16 justify-center">
            <div class="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <span class="text-sm text-[var(--color-muted)]">{t('admin.loading')}</span>
          </div>
        </Show>

        <Show when={!loading() && reports().length === 0}>
          <div class="text-center py-12 border border-dashed border-[var(--color-border)] rounded-xl">
            <p class="text-[var(--color-muted)] text-sm">{t('myReports.empty')}</p>
          </div>
        </Show>

        <Show when={!loading() && reports().length > 0}>
          <div class="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
            <For each={reports()}>
              {(report) => (
                <div class="border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-bg)]">
                  <div class="flex items-center gap-2 flex-wrap mb-2">
                    <span class="text-sm font-semibold text-[var(--color-text)]">
                      {reportTypeLabel(report.issue_type)}
                    </span>
                    <span class={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLE[report.status] ?? ''}`}>
                      {reportStatusLabel(report.status)}
                    </span>
                  </div>

                  <Show when={report.tune_media}>
                    <div class="text-xs text-[var(--color-muted)] flex items-center gap-2 flex-wrap mb-1.5">
                      <Show when={report.tune_media.title}>
                        <span class="truncate max-w-[200px]">{report.tune_media.title}</span>
                      </Show>
                      <span class="font-mono">{extractYoutubeId(report.tune_media.media_uri)}</span>
                      <a
                        href={report.tune_media.media_uri}
                        target="_blank" rel="noopener noreferrer"
                        class="text-[var(--color-primary)] hover:underline"
                      >{t('report.viewVideo')}</a>
                    </div>
                  </Show>

                  <div class="text-[10px] text-[var(--color-muted)]/60">
                    {formatDate(report.created_at)}
                    <Show when={report.closed_at}>
                      <span class="ml-2">{t('report.closed')} {formatDate(report.closed_at)}</span>
                    </Show>
                  </div>

                  <Show when={report.admin_comments}>
                    <div class="mt-2 pt-2 border-t border-[var(--color-border)]">
                      <p class="text-[10px] font-semibold text-[var(--color-muted)] mb-1">{t('report.adminComments')}</p>
                      <p class="text-xs text-[var(--color-muted)] whitespace-pre-wrap">{report.admin_comments}</p>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
