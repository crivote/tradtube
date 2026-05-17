import { createContext, useContext, createSignal, createMemo } from 'solid-js';
import { translator, flatten, resolveTemplate } from '@solid-primitives/i18n';
import de from './locales/de';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';

const dictionaries = { de, en, es, fr };

const flatDicts = Object.fromEntries(
  Object.entries(dictionaries).map(([key, dict]) => [key, flatten(dict)]),
);

const STORAGE_KEY = 'tradtube-locale';

function detectLocale() {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
  const code = lang.split('-')[0];
  return flatDicts[code] ? code : 'en';
}

let persisted = null;
if (typeof localStorage !== 'undefined') {
  persisted = localStorage.getItem(STORAGE_KEY);
  if (persisted && !flatDicts[persisted]) persisted = null;
}

const I18nContext = createContext();

export function I18nProvider(props) {
  const [locale, setLocale] = createSignal(persisted || detectLocale());

  const t = translator(() => flatDicts[locale()], resolveTemplate);

  createMemo(() => {
    const loc = locale();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, loc);
    }
  });

  return (
    <I18nContext.Provider value={{ t, locale, setLocale }}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}
