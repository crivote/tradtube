/**
 * Breadcrumbs.jsx
 * Migas de pan de navegación calculadas desde location.pathname.
 * Solo muestra rutas (nunca acciones); cada segmento padre es clickeable.
 * El logo (home) vive en el Header como respaldo de navegación.
 */
import { Show, For } from 'solid-js';
import { useLocation, useNavigate } from '@solidjs/router';
import { ChevronRight, Home } from 'lucide-solid';
import { useI18n } from '../i18n';
import { useAppStore } from '../store/appStore';

// Ruta conocida → etiqueta i18n + href base. Match por segmento exacto.
const SEGMENTS = [
  { match: (s) => s === 'favorites', label: (t) => t('app.favorites'), href: '/favorites' },
  { match: (s) => s === 'playlists', label: (t) => t('app.myPlaylists'), href: '/playlists' },
  { match: (s) => s === 'my-submissions', label: (t) => t('app.mySubmissions'), href: '/my-submissions' },
  { match: (s) => s === 'my-recordings', label: (t) => t('app.myRecordings'), href: '/my-recordings' },
  { match: (s) => s === 'my-reports', label: (t) => t('app.myReports'), href: '/my-reports' },
  { match: (s) => s === 'admin', label: (t) => t('app.admin'), href: '/admin' },
];

export default function Breadcrumbs() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { selectedTune } = useAppStore();

  // Lista de { href, label } sin el home; vacía en la raíz.
  const crumbs = () => {
    const segs = location.pathname.split('/').filter(Boolean);
    const out = [];
    for (let i = 0; i < segs.length; i++) {
      const raw = segs[i];
      const isLast = i === segs.length - 1;
      const prevHref = '/' + segs.slice(0, i + 1).join('/');

      // Ruta con id: tune/:id o playlist/:id — etiqueta contextual.
      if (raw === 'tune' && isLast) {
        out.push({ href: prevHref, label: selectedTune()?.name || t('tune.sheet') });
        continue;
      }
      if (raw === 'playlist' && isLast) {
        out.push({ href: prevHref, label: t('app.myPlaylists') });
        continue;
      }

      const seg = SEGMENTS.find((s) => s.match(raw));
      const label = seg ? seg.label(t) : raw;
      if (label === null) break;
      out.push({ href: prevHref, label });
    }
    return out;
  };

  const isCurrent = (href) => href === location.pathname;

  return (
    <nav aria-label="breadcrumb" class="flex items-center gap-1.5 min-w-0 flex-shrink">
      <Home size={14} class="text-[var(--color-muted)]/70 flex-shrink-0" />
      <For each={[{ href: '/', label: t('app.home') }, ...crumbs()]}>
        {(crumb, i) => (
          <>
            <Show when={i() > 0}>
              <ChevronRight size={12} class="text-[var(--color-muted)]/50 flex-shrink-0" />
            </Show>
            <Show
              when={!isCurrent(crumb.href)}
              fallback={
                <span class="text-sm font-medium text-[var(--color-text)] truncate max-w-[36vw] sm:max-w-[160px]">
                  {crumb.label}
                </span>
              }
            >
              <button
                onClick={() => navigate(crumb.href)}
                class="text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors truncate max-w-[36vw] sm:max-w-[160px]"
              >
                {crumb.label}
              </button>
            </Show>
          </>
        )}
      </For>
    </nav>
  );
}
