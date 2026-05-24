/**
 * lib/db.js
 * Inicializa sqlite-wasm y expone helpers para consultar thesession.db
 * La DB se carga una sola vez como asset estático desde /public/thesession.db
 */

import { DB_PATH } from '../constants';

let _db = null;
let _initPromise = null;

export function getDB() {
  return _db;
}

export async function initDB() {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {

  const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default;
  const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });

  // Cargar el archivo .db como ArrayBuffer
  const response = await fetch(DB_PATH);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Abrir DB desde los bytes descargados
  _db = new sqlite3.oo1.DB();
  sqlite3.capi.sqlite3_deserialize(
    _db.pointer,
    'main',
    sqlite3.wasm.allocFromTypedArray(bytes),
    bytes.length,
    bytes.length,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
    sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE
  );

  return _db;
})().catch((err) => { _initPromise = null; throw err; });

return _initPromise;
}

/**
 * Búsqueda FTS5 de tunes por nombre (o alias)
 * Devuelve array de { tune_id, name, type, meter, composer, tunebooks, popularity_score }
 */
export function searchTunes(query, limit = 10) {
  if (!_db || !query?.trim()) return [];

  // Escape double quotes for FTS5, wrap in quotes for phrase matching + prefix
  const safe = query.trim().replace(/"/g, '""');
  const ftsQuery = `"${safe}"*`;

  return _db.exec({
    sql: `
      SELECT t.tune_id, t.name, t.type, t.meter, t.composer, t.tunebooks, t.popularity_score
      FROM tunes_search ts
      JOIN tunes t ON t.tune_id = CAST(ts.tune_id AS INTEGER)
      WHERE tunes_search MATCH ?
      ORDER BY t.tunebooks DESC
      LIMIT ?
    `,
    bind: [ftsQuery, limit],
    returnValue: 'resultRows',
    rowMode: 'object',
  });
}

/**
 * Devuelve tunes de un tipo concreto ordenados por popularidad
 * Devuelve array de { tune_id, name, type, meter, composer, tunebooks, popularity_score }
 */
export function searchTunesByType(type, limit = 500) {
  if (!_db || !type) return [];

  return _db.exec({
    sql: `
      SELECT tune_id, name, type, meter, composer, tunebooks, popularity_score
      FROM tunes WHERE type = ? ORDER BY tunebooks DESC LIMIT ?
    `,
    bind: [type, limit],
    returnValue: 'resultRows',
    rowMode: 'object',
  });
}

/**
 * Obtiene los settings (variaciones ABC) de un tune
 */
export function getSettings(tuneId) {
  if (!_db) return [];

  return _db.exec({
    sql: `SELECT id, abc, key FROM settings WHERE tune_id = ? LIMIT 10`,
    bind: [tuneId],
    returnValue: 'resultRows',
    rowMode: 'object',
  });
}

/**
 * Obtiene un tune por su ID
 */
export function getTuneById(tuneId) {
  if (!_db) return null;
  const results = _db.exec({
    sql: `SELECT tune_id, name, type, meter, composer FROM tunes WHERE tune_id = ? LIMIT 1`,
    bind: [tuneId],
    returnValue: 'resultRows',
    rowMode: 'object',
  });
  return results[0] ?? null;
}

/**
 * Obtiene tunes similares precalculados
 */
export function getSimilarTunes(tuneId, limit = 5) {
  if (!_db) return [];

  return _db.exec({
    sql: `
      SELECT t.tune_id, t.name, t.type, ts.score
      FROM tune_similarities ts
      JOIN tunes t ON t.tune_id = ts.recommended_tune_id
      WHERE ts.tune_id = ?
      ORDER BY ts.score DESC
      LIMIT ?
    `,
    bind: [tuneId, limit],
    returnValue: 'resultRows',
    rowMode: 'object',
  });
}

/**
 * Obtiene n tunes aleatorios de la base de datos
 */
export function getRandomTunes(limit = 2) {
  if (!_db) return [];

  return _db.exec({
    sql: `SELECT tune_id, name, type, meter FROM tunes ORDER BY RANDOM() LIMIT ?`,
    bind: [limit],
    returnValue: 'resultRows',
    rowMode: 'object',
  });
}

/**
 * Obtiene el conteo de tunes por tipo (solo los que tienen vídeos)
 */
let _typeIndexCreated = false;

export function getCountsByType(types, videoCounts) {
  if (!_db || !types?.length) return {};

  if (!_typeIndexCreated) {
    try { _db.exec('CREATE INDEX IF NOT EXISTS idx_tunes_type ON tunes(type)'); } catch {}
    _typeIndexCreated = true;
  }

  const placeholders = types.map(() => '?').join(', ');
  const rows = _db.exec({
    sql: `SELECT type, COUNT(*) as cnt FROM tunes WHERE type IN (${placeholders}) GROUP BY type`,
    bind: types,
    returnValue: 'resultRows',
    rowMode: 'object',
  });

  const totalByType = {};
  for (const row of rows) totalByType[row.type] = row.cnt;

  const tuneIdsWithVideos = videoCounts?.size ? new Set(videoCounts.keys()) : null;

  if (tuneIdsWithVideos && tuneIdsWithVideos.size > 0) {
    const withVideosRows = _db.exec({
      sql: `SELECT type, COUNT(*) as cnt FROM tunes WHERE tune_id IN (${Array.from(tuneIdsWithVideos).map(() => '?').join(',')}) AND type IN (${placeholders}) GROUP BY type`,
      bind: [...tuneIdsWithVideos, ...types],
      returnValue: 'resultRows',
      rowMode: 'object',
    });
    const withVideosByType = {};
    for (const row of withVideosRows) withVideosByType[row.type] = row.cnt;

    const result = {};
    for (const type of types) {
      result[type] = { total: totalByType[type] ?? 0, withVideos: withVideosByType[type] ?? 0 };
    }
    return result;
  }

  const result = {};
  for (const type of types) {
    result[type] = { total: totalByType[type] ?? 0, withVideos: 0 };
  }
  return result;
}

export const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
  'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
  'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
  'did', 'let', 'put', 'say', 'she', 'too', 'use', 'this', 'with', 'from',
  'live', 'session', 'music', 'cover', 'video', 'song', 'feat',
  'official', 'hd', 'studio', 'recording', 'pub', 'irish',
  'reel', 'jig', 'hornpipe', 'polka', 'slide', 'waltz', 'march', 'slip',
  'set', 'dance', 'air', 'tune', 'tunes',
  'trad', 'traditional', 'played', 'version', 'full', 'original', 'slow', 'fast',
  'medley', 'parts',
  'de', 'le', 'la', 'les', 'des', 'du',
]);

export function findMatchingTunes(text, existingIds = new Set()) {
  if (!text || !_db) return [];

  const cleaned = text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ');

  const phrases = cleaned.split(/[,;\/|–—\\-]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const seen = new Set(existingIds);
  const matches = [];

  for (const phrase of phrases) {
    const words = phrase
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .filter(w => !STOP_WORDS.has(w.toLowerCase()))
      .filter(w => !/^\d+$/.test(w));

    if (words.length === 0) continue;

    const results = searchTunes(words.join(' '), 5);
    for (const tune of results) {
      if (!seen.has(tune.tune_id)) {
        seen.add(tune.tune_id);
        matches.push(tune);
      }
    }

    if (matches.length >= 8) break;
  }

  return matches.slice(0, 8);
}
