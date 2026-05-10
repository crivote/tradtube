/**
 * lib/db.js
 * Inicializa sqlite-wasm y expone helpers para consultar thesession.db
 * La DB se carga una sola vez como asset estático desde /public/thesession.db
 */

import { DB_PATH } from '../constants';

let _db = null;

export function getDB() {
  return _db;
}

export async function initDB() {
  if (_db) return _db;

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
}

/**
 * Búsqueda FTS5 de tunes por nombre (o alias)
 * Devuelve array de { tune_id, name, type, meter, composer, tunebooks, popularity_score }
 */
export function searchTunes(query, limit = 10) {
  if (!_db || !query?.trim()) return [];

  // Escapar comillas para FTS5 (dobles y simples)
  const safe = query.trim().replace(/"/g, '""').replace(/'/g, "''");

  return _db.exec({
    sql: `
      SELECT t.tune_id, t.name, t.type, t.meter, t.composer, t.tunebooks, t.popularity_score
      FROM tunes_search ts
      JOIN tunes t ON t.tune_id = CAST(ts.tune_id AS INTEGER)
      WHERE tunes_search MATCH ?
      ORDER BY t.tunebooks DESC
      LIMIT ?
    `,
    bind: [`${safe}*`, limit],
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
export function getCountsByType(types, videoCounts) {
  if (!_db || !types?.length) return {};

  const placeholders = types.map(() => '?').join(', ');
  const rows = _db.exec({
    sql: `SELECT tune_id, type FROM tunes WHERE type IN (${placeholders})`,
    bind: types,
    returnValue: 'resultRows',
    rowMode: 'object',
  });

  const tuneIdsWithVideos = videoCounts?.size ? new Set(videoCounts.keys()) : null;
  const result = {};
  for (const type of types) {
    result[type] = { total: 0, withVideos: 0 };
  }

  for (const row of rows) {
    result[row.type].total++;
    if (tuneIdsWithVideos?.has(row.tune_id)) {
      result[row.type].withVideos++;
    }
  }

  return result;
}
