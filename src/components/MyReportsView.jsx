/**
 * MyReportsView.jsx
 * Página de reportes propios (ruta /my-reports).
 */
import { useI18n } from '../i18n';
import MyReports from './MyReports';

export default function MyReportsView() {
  const { t } = useI18n();
  return (
    <div class="max-w-3xl mx-auto">
      <h2 class="text-2xl font-black text-[var(--color-text)] mb-6">
        {t('app.myReports')}
      </h2>
      <MyReports variant="page" />
    </div>
  );
}
