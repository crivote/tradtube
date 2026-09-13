/**
 * MyRecordingsView.jsx
 * Página de grabaciones propias (ruta /my-recordings).
 * Reutiliza el contenido de UserRecordingsView, sin el botón de cierre
 * propio de su uso anterior como modal.
 */
import { Show } from 'solid-js';
import { useI18n } from '../i18n';
import UserRecordingsView from './UserRecordingsView';

export default function MyRecordingsView() {
  const { t } = useI18n();
  return (
    <div class="max-w-3xl mx-auto">
      <h2 class="text-2xl font-black text-[var(--color-text)] mb-6">
        {t('app.myRecordings')}
      </h2>
      <UserRecordingsView />
    </div>
  );
}
