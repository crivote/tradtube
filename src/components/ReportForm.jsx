import { createSignal, Show } from 'solid-js';
import { createReport } from '../lib/supabase';
import { useI18n } from '../i18n';

const ISSUE_TYPES = [
  'wrong_tune',
  'wrong_timestamps',
  'wrong_key',
  'poor_quality',
  'duplicate',
  'inappropriate',
  'other',
];

export default function ReportForm(props) {
  const { t } = useI18n();
  const [issueType, setIssueType] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [submitted, setSubmitted] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!issueType()) return;
    setSubmitting(true);
    setError('');
    try {
      await createReport({
        video_id: props.videoId,
        tune_id: props.tuneId,
        issue_type: issueType(),
        description: description().trim() || null,
        email: email().trim() || null,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => props.onClose()}>
      <div
        class="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <Show
          when={submitted()}
          fallback={
            <>
              <div class="flex items-center justify-between mb-5">
                <h3 class="text-lg font-bold text-[var(--color-text)]">{t('report.title')}</h3>
                <button
                  onClick={() => props.onClose()}
                  class="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors text-sm"
                >{t('report.close')}</button>
              </div>

              <Show when={error()}>
                <div class="mb-4 p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-sm text-[var(--color-error)]">
                  {error()}
                </div>
              </Show>

              <form onSubmit={handleSubmit} class="flex flex-col gap-4">
                <div>
                  <label class="block text-xs font-semibold text-[var(--color-muted)] mb-1.5">
                    {t('report.issueType')} *
                  </label>
                  <select
                    value={issueType()}
                    onChange={(e) => setIssueType(e.target.value)}
                    class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="">{t('report.selectType')}</option>
                    {ISSUE_TYPES.map((type) => (
                      <option value={type}>{t(`report.types.${type}`)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-[var(--color-muted)] mb-1.5">
                    {t('report.description')}
                    <Show when={issueType() === 'other'}>
                      <span class="text-[var(--color-error)]"> *</span>
                    </Show>
                  </label>
                  <textarea
                    value={description()}
                    onInput={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder={t('report.descriptionPlaceholder')}
                    class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-[var(--color-muted)] mb-1.5">
                    {t('report.email')}
                  </label>
                  <input
                    type="email"
                    value={email()}
                    onInput={(e) => setEmail(e.target.value)}
                    placeholder={t('report.emailPlaceholder')}
                    class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting() || !issueType() || (issueType() === 'other' && !description().trim())}
                  class="mt-1 text-sm px-4 py-2 rounded-lg bg-[var(--color-primary)] text-black font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {submitting() ? t('report.submitting') : t('report.submit')}
                </button>
              </form>
            </>
          }
        >
          <div class="text-center py-6">
            <p class="text-3xl mb-3">✓</p>
            <p class="text-[var(--color-text)] font-semibold">{t('report.submitted')}</p>
            <p class="text-sm text-[var(--color-muted)] mt-1">{t('report.thankYou')}</p>
            <button
              onClick={() => props.onClose()}
              class="mt-4 text-sm px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
            >{t('report.close')}</button>
          </div>
        </Show>
      </div>
    </div>
  );
}
