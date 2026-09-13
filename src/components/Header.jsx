/**
 * Header.jsx
 * Barra superior reestructurada: logo + breadcrumbs a la izquierda,
 * acciones globales (tema/idioma) y botón primario (+ Añadir vídeo),
 * y las entradas "Mías"/Admin/logout colapsadas en un menú de acciones.
 *
 * La barra ya no acumula botones: solo logo+breadcrumb, tema, idioma,
 * botón primario y el avatar/menú.
 */
import { Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Moon, Sun } from 'lucide-solid';
import { useAppStore } from '../store/appStore';
import { loginWithGoogle } from '../lib/supabase';
import { useI18n } from '../i18n';
import Breadcrumbs from './Breadcrumbs';
import ActionsMenu from './ActionsMenu';

export default function Header() {
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();
  const {
    authUser, loggingIn, setLoggingIn, showToast,
    theme, toggleTheme,
    setSearchQuery, setFilterType, setFilterInstrument, setSelectedTune,
    setShowAddForm, setAddFormInitialTune,
  } = useAppStore();

  // Resetear estado global al ir al home (mismo comportamiento previo del logo).
  const goHome = () => {
    setShowAddForm(false);
    setAddFormInitialTune(null);
    setSearchQuery('');
    setFilterType(null);
    setFilterInstrument(null);
    setSelectedTune(null);
    navigate('/');
  };

  const handleLogin = async () => {
    setLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setLoggingIn(false);
      showToast(t('login.failed'), 'error');
    }
  };

  return (
    <header class="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur">
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

        {/* Logo + Breadcrumbs */}
        <div class="flex items-center gap-3 min-w-0 flex-shrink">
          <button
            onClick={goHome}
            class="flex items-center gap-2.5 flex-shrink-0 hover:opacity-80 transition-opacity"
            aria-label={t('app.home')}
          >
            <div class="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
              <img src="/favicon.png" alt="TradTube" class="w-6 h-6 object-contain" />
            </div>
            {/* El nombre se oculta en móvil para dejar sitio al breadcrumb */}
            <h1 class="font-black text-base tracking-tight uppercase hidden sm:block">
              <span class="text-[var(--color-text)]">Trad</span><span class="text-[var(--color-primary)] font-light">Tube</span>
            </h1>
          </button>
          <div class="w-px h-6 bg-[var(--color-border)] hidden sm:block flex-shrink-0" />
          <Breadcrumbs />
        </div>

        {/* Tema + idioma + primario + menú */}
        <div class="flex items-center gap-2 flex-shrink-0">
          <div class="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              class="text-[var(--color-muted)] hover:text-[var(--color-primary)] transition-colors p-1.5 rounded-lg"
              title={theme() === 'dark' ? t('app.switchToLight') : t('app.switchToDark')}
            >
              <Show when={theme() === 'dark'} fallback={<Moon size={16} />}>
                <Sun size={16} />
              </Show>
            </button>

            <select
              value={locale()}
              onChange={(e) => setLocale(e.target.value)}
              aria-label="Language"
              class="text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-1.5 py-1 text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] cursor-pointer appearance-none"
            >
              <option value="de">DE</option>
              <option value="en">EN</option>
              <option value="es">ES</option>
              <option value="fr">FR</option>
            </select>
          </div>

          <Show
            when={authUser()}
            fallback={
              <button
                onClick={handleLogin}
                disabled={loggingIn()}
                class="text-xs px-4 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50 transition-colors disabled:opacity-50"
              >
                {loggingIn() ? t('app.redirecting') : t('app.login')}
              </button>
            }
          >
            <>
              {/* Botón primario: única acción destacada fuera del menú */}
              <button
                onClick={() => { setAddFormInitialTune(null); setShowAddForm((v) => !v); }}
                class="text-xs px-4 py-1.5 rounded-lg font-semibold transition-colors bg-[var(--color-primary)] text-black hover:bg-green-400"
              >
                {t('app.addVideo')}
              </button>
              <ActionsMenu />
            </>
          </Show>
        </div>
      </div>
    </header>
  );
}
