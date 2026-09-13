/**
 * ActionsMenu.jsx
 * Menú de acciones del usuario colapsado en un dropdown (botón ⋮ / avatar).
 * Agrupa las entradas de navegación "Mías" + Admin + logout. Cierra al
 * navegar o al hacer clic fuera (backdrop translúcido).
 */
import { createSignal, Show, For } from 'solid-js';
import { useNavigate, useLocation } from '@solidjs/router';
import {
  Mic, FileText, Send, ListMusic, Heart, Shield, LogOut,
} from 'lucide-solid';
import { useI18n } from '../i18n';
import { useAppStore } from '../store/appStore';
import { logout } from '../lib/supabase';

export default function ActionsMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { authUser, pendingReviewCount } = useAppStore();
  const [open, setOpen] = createSignal(false);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const items = () => {
    const list = [
      { key: 'recordings', label: t('app.myRecordings'), href: '/my-recordings', icon: Mic },
      { key: 'submissions', label: t('app.mySubmissions'), href: '/my-submissions', icon: Send },
      { key: 'reports', label: t('app.myReports'), href: '/my-reports', icon: FileText },
      { key: 'playlists', label: t('app.myPlaylists'), href: '/playlists', icon: ListMusic },
      { key: 'favorites', label: t('app.favorites'), href: '/favorites', icon: Heart },
    ];
    if (authUser()?.isAdmin) {
      list.push({ key: 'admin', label: t('app.admin'), href: '/admin', icon: Shield, badge: () => pendingReviewCount() });
    }
    return list;
  };

  const isActive = (href) => location.pathname === href || location.pathname.startsWith(href + '/');

  return (
    <div class="relative">
      {/* Botón que abre el menú — avatar del usuario cuando hay sesión */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('app.menu')}
        aria-expanded={open()}
        class="flex items-center justify-center w-9 h-9 rounded-full border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors"
      >
        <Show
          when={authUser()?.user_metadata?.avatar_url}
          fallback={
            <div class="w-7 h-7 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center text-xs font-bold capitalize">
              {(authUser()?.email || '?')[0]}
            </div>
          }
        >
          <img
            src={authUser().user_metadata.avatar_url}
            alt=""
            class="w-7 h-7 rounded-full object-cover"
          />
        </Show>
      </button>

      <Show when={open()}>
        {/* Backdrop para cerrar al clic fuera */}
        <div
          class="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
        <div class="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl z-50 overflow-hidden">
          {/* Cabecera de identidad */}
          <div class="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <Show
              when={authUser()?.user_metadata?.avatar_url}
              fallback={
                <div class="w-8 h-8 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center text-sm font-bold capitalize">
                  {(authUser()?.email || '?')[0]}
                </div>
              }
            >
              <img
                src={authUser().user_metadata.avatar_url}
                alt=""
                class="w-8 h-8 rounded-full object-cover"
              />
            </Show>
            <div class="min-w-0">
              <Show when={authUser()?.user_metadata?.name}>
                <p class="text-sm font-semibold text-[var(--color-text)] truncate">
                  {authUser().user_metadata.name}
                </p>
              </Show>
              <p class="text-xs text-[var(--color-muted)] truncate">
                {authUser()?.email}
              </p>
            </div>
          </div>

          <div class="py-1">
            <For each={items()}>
              {(item) => {
                const Icon = item.icon;
                const isCur = isActive(item.href);
                return (
                  <button
                    onClick={() => go(item.href)}
                    class={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                      ${isCur
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]'
                      }`}
                  >
                    <Icon size={16} class="flex-shrink-0" />
                    <span class="flex-grow text-left truncate">{item.label}</span>
                    {item.key === 'admin' && item.badge?.() > 0 && (
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-warning)]/20 text-[var(--color-warning)] border border-[var(--color-warning)]/30 leading-none">
                        {item.badge()}
                      </span>
                    )}
                  </button>
                );
              }}
            </For>

            <div class="border-t border-[var(--color-border)] my-1" />

            <button
              onClick={() => { setOpen(false); logout(); }}
              class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-bg)] transition-colors"
            >
              <LogOut size={16} class="flex-shrink-0" />
              <span class="flex-grow text-left">{t('app.logOut')}</span>
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}
