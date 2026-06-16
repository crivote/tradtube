import Database from 'better-sqlite3';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const db = new Database(join(projectRoot, 'public', 'thesession.db'), { readonly: true });

const rows = db.prepare('SELECT tune_id, name, type FROM tunes ORDER BY tune_id').all();

const result = {};
for (const row of rows) {
  result[row.tune_id] = { n: row.name, t: row.type };
}

db.close();

const outDir = join(projectRoot, 'netlify', 'edge-functions');
mkdirSync(outDir, { recursive: true });

const outPath = join(outDir, 'tunes-meta.json');
writeFileSync(outPath, JSON.stringify(result));
console.log(`Wrote ${rows.length} tunes to ${outPath}`);
