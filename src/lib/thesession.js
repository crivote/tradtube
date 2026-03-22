/**
 * lib/thesession.js
 * Helpers para acceder a la API JSON de TheSession.org
 * No requiere API key. CORS habilitado por TheSession.
 */

const BASE = 'https://thesession.org';

/**
 * Extrae el ID numérico de un recording desde una URL completa o un ID bare.
 * Ejemplos válidos:
 *   "https://thesession.org/recordings/158"
 *   "https://thesession.org/recordings/158?format=json"
 *   "158"
 * Devuelve un number o null si no se puede parsear.
 */
export function parseRecordingUrl(input) {
  if (!input) return null;
  const s = input.trim();
  const m = s.match(/\/recordings\/(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  return null;
}

/**
 * Obtiene los datos de un recording desde la API de TheSession.
 * Lanza un error descriptivo si no se encuentra o falla la red.
 */
export async function fetchRecording(id) {
  const res = await fetch(`${BASE}/recordings/${id}?format=json`);
  if (res.status === 404) throw new Error('Recording not found');
  if (!res.ok) throw new Error(`TheSession error ${res.status}`);
  return res.json();
}

/**
 * Resuelve las tunes de un track contra el SQLite local.
 * getTuneByIdFn debe ser getTuneById de lib/db.js (síncrona).
 *
 * Devuelve array de:
 *   { name, tuneId, tune, unresolvable }
 *   - tune: objeto SQLite si fue encontrado, null si no
 *   - unresolvable: true si no tiene ID o no está en SQLite
 */
export function resolveTrackTunes(track, getTuneByIdFn) {
  return (track.tunes || []).map(t => {
    if (!t.id) {
      return { name: t.name, tuneId: null, tune: null, unresolvable: true };
    }
    const tune = getTuneByIdFn(t.id);
    return {
      name: t.name,
      tuneId: t.id,
      tune,
      unresolvable: tune === null,
    };
  });
}

/**
 * Formatea los nombres de las tunes de un track como "Tune A / Tune B / Tune C"
 */
export function formatTrackLabel(track) {
  return (track.tunes || []).map(t => t.name).join(' / ');
}
