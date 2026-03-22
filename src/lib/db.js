/**
 * lib/db.js
 * Inicializa sqlite-wasm y expone helpers para consultar thesession.db
 * La DB se carga una sola vez como asset estático desde /public/thesession.db
 */

import { DB_PATH } from '../constants';

let db = null;

export async function initDB() {
  if (db) return db;

  const sqlite3InitModule = (await import('@sqlite.org/sqlite-wasm')).default;
  const sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });

  // Cargar el archivo .db como ArrayBuffer
  const response = await fetch(DB_PATH);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Abrir DB desde los bytes descargados
  db = new sqlite3.oo1.DB();
  sqlite3.capi.sqlite3_deserialize(
    db.pointer,
    'main',
    sqlite3.wasm.allocFromTypedArray(bytes),
    bytes.length,
    bytes.length,
    sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
    sqlite3.capi.SQLITE_DESERIALIZE_RESIZEABLE
  );

  console.log('[TradTube] thesession.db cargada en memoria');
  return db;
}

/**
 * Búsqueda FTS5 de tunes por nombre (o alias)
 * Devuelve array de { tune_id, name, type, meter, tunebooks, popularity_score }
 */
export function searchTunes(query, limit = 10) {
  if (!db || !query?.trim()) return [];

  // Escapar comillas para FTS5
  const safe = query.trim().replace(/"/g, '""');

  return db.exec({
    sql: `
      SELECT t.tune_id, t.name, t.type, t.meter, t.tunebooks, t.popularity_score
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
 * Obtiene los settings (variaciones ABC) de un tune
 */
export function getSettings(tuneId) {
  if (!db) return [];

  return db.exec({
    sql: `SELECT id, abc, key FROM settings WHERE tune_id = ? LIMIT 10`,
    bind: [tuneId],
    returnValue: 'resultRows',
    rowMode: 'object',
  });
}

/**
 * Obtiene tunes similares precalculados
 */
export function getSimilarTunes(tuneId, limit = 5) {
  if (!db) return [];

  return db.exec({
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
