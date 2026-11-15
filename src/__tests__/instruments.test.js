/**
 * Invariante del catálogo de instrumentos: una clave sin etiqueta en algún
 * locale se pinta tal cual («piano_accordion») en la ficha pública, y una clave
 * del catálogo que falte en los grupos es invisible en el desplegable del
 * editor. Ambas cosas se detectan aquí, no en producción.
 */
import { describe, it, expect } from 'vitest';
import { INSTRUMENTS, INSTRUMENT_KEYS, INSTRUMENT_GROUPS } from '../constants';
import es from '../i18n/locales/es';
import en from '../i18n/locales/en';
import fr from '../i18n/locales/fr';
import de from '../i18n/locales/de';

const LOCALES = { es, en, fr, de };

describe('catálogo de instrumentos', () => {
  it('cada clave tiene etiqueta no vacía en los cuatro idiomas', () => {
    const missing = [];
    for (const [code, dict] of Object.entries(LOCALES)) {
      for (const key of INSTRUMENT_KEYS) {
        const label = dict.instruments?.[key];
        if (typeof label !== 'string' || label.trim() === '') missing.push(`${code}:${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('cada grupo de traducción tiene etiqueta en los cuatro idiomas', () => {
    const missing = [];
    for (const [code, dict] of Object.entries(LOCALES)) {
      for (const group of INSTRUMENT_GROUPS) {
        const label = dict.instrumentGroups?.[group.key];
        if (typeof label !== 'string' || label.trim() === '') missing.push(`${code}:${group.key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('los grupos cubren todas las claves, sin repetir y sin inventar', () => {
    const grouped = INSTRUMENT_GROUPS.flatMap(g => g.keys);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual([...INSTRUMENT_KEYS].sort());
  });

  it('incluye gaitas y acordeón de piano, que faltaban en el editor', () => {
    for (const key of ['gaita', 'biniou', 'highland_pipes', 'smallpipes', 'border_pipes', 'piano_accordion', 'button_accordion']) {
      expect(INSTRUMENTS[key], key).toBeDefined();
    }
  });

  it('conserva las claves históricas que ya están escritas en la base', () => {
    for (const key of ['fiddle', 'flute', 'uileann_pipes', 'whistle', 'banjo', 'concertina', 'melodeon', 'mandolin', 'mandola', 'various']) {
      expect(INSTRUMENTS[key], key).toBeDefined();
    }
  });
});
