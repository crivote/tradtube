#!/usr/bin/env python3
"""Regenera `public/thesession.db` desde el dump oficial de TheSession.

Fuente: https://github.com/adactio/TheSession-data (CSV, actualizado ~semanalmente
por el propio autor de TheSession). Tres ficheros bastan para el esquema que usa
TradTube: `tunes.csv` (una fila por *setting*), `aliases.csv` y `tune_popularity.csv`.

Por qué no se usa la API tune a tune: 23.000 peticiones frente a tres descargas.
La API solo se consulta en el top-up (`--top-up N`), para incorporar los tunes
publicados después de la última actualización del dump.

Decisiones que hay que respetar (medidas contra la copia del 2026-07-02):

- `name` va **invertido** cuando el título lleva artículo: «The Kesh» → «Kesh, The».
  El dump ya lo trae así; el top-up por API lo invierte en `invert_name()`.
- `composer` es el primer valor no vacío entre los settings del tune. El dump lo
  deja vacío en algunos tunes que sí lo tienen (p. ej. 248 «Tam Lin»), así que
  `--old-db` rellena esos huecos con el valor de la copia anterior.
- `aliases` se concatenan con un espacio, en el orden del CSV.
- `popularity_score` es un percentil 0-99 de `tunebooks` entre los tunes con al
  menos un tunebook. La copia vieja usaba una escala algo distinta pero igualmente
  monótona en `tunebooks`; da igual cuál sea porque el número **no se muestra en
  ninguna UI**: solo ordena (tradtracker, feeder). Lo que importa es que el orden
  sea el de `tunebooks`.

Uso:
    python3 scripts/build-thesession-db.py --cache ~/.cache/tsdump
    python3 scripts/build-thesession-db.py --top-up 40 --old-db /ruta/copia-vieja.db
"""

import argparse
import csv
import datetime as dt
import hashlib
import json
import os
import sqlite3
import sys
import tempfile
import time
import urllib.error
import urllib.request

DUMP_REPO = "adactio/TheSession-data"
DUMP_CSV = f"https://raw.githubusercontent.com/{DUMP_REPO}/main/csv/"
DUMP_COMMITS = f"https://api.github.com/repos/{DUMP_REPO}/commits?per_page=1"
API_TUNE = "https://thesession.org/tunes/%d?format=json"
UA = "tradtube-catalogue-builder/1.0 (+https://github.com/crivote/tradtube)"

SCHEMA_TUNES = """CREATE TABLE tunes (
        tune_id INTEGER PRIMARY KEY,
        name TEXT,
        type TEXT,
        meter TEXT,
        composer TEXT,
        tunebooks INTEGER,
        popularity_score INTEGER
    )"""
SCHEMA_FTS = """CREATE VIRTUAL TABLE tunes_search USING fts5(
        tune_id UNINDEXED,
        name,
        aliases,
        type,
        tokenize='unicode61'
    )"""
INDEXES = [
    "CREATE INDEX idx_tunebooks ON tunes(tunebooks)",
    "CREATE INDEX idx_popularity ON tunes(popularity_score)",
    "CREATE INDEX idx_type ON tunes(type)",
    "CREATE INDEX idx_meter ON tunes(meter)",
]
CSV_FILES = ("tunes.csv", "aliases.csv", "tune_popularity.csv")


def log(msg):
    print(msg, flush=True)


def fetch(url, timeout=180, retries=3):
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            last = exc
        except Exception as exc:  # noqa: BLE001 - red inestable
            last = exc
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"no se pudo descargar {url}: {last}")


def download_dump(cache_dir):
    os.makedirs(cache_dir, exist_ok=True)
    paths = {}
    for name in CSV_FILES:
        path = os.path.join(cache_dir, name)
        raw = fetch(DUMP_CSV + name)
        if raw is None:
            raise RuntimeError(f"404 en el dump: {name}")
        with open(path, "wb") as fh:
            fh.write(raw)
        paths[name] = path
        log(f"  {name}: {len(raw)/1e6:.1f} MB")
    return paths


def dump_commit():
    try:
        raw = fetch(DUMP_COMMITS, timeout=60)
        data = json.loads(raw.decode("utf-8"))
        return {
            "repo": DUMP_REPO,
            "commit": data[0]["sha"],
            "date": data[0]["commit"]["committer"]["date"],
        }
    except Exception as exc:  # noqa: BLE001
        log(f"  aviso: no se pudo leer el commit del dump ({exc})")
        return {"repo": DUMP_REPO, "commit": None, "date": None}


def invert_name(name):
    """«The Kesh» → «Kesh, The». El dump ya viene invertido; la API no."""
    name = (name or "").strip()
    if name.startswith("The ") and len(name) > 4:
        return f"{name[4:]}, The"
    return name


def load_tunes(path):
    """tune_id → {name, type, meter, composer}. Una fila por setting."""
    csv.field_size_limit(10**9)
    tunes = {}
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            tid = int(row["tune_id"])
            entry = tunes.get(tid)
            if entry is None:
                tunes[tid] = {
                    "name": (row["name"] or "").strip(),
                    "type": (row["type"] or "").strip(),
                    "meter": (row["meter"] or "").strip(),
                    "composer": (row["composer"] or "").strip(),
                    "settings": 1,
                }
            else:
                entry["settings"] += 1
                if not entry["composer"] and (row["composer"] or "").strip():
                    entry["composer"] = row["composer"].strip()
    return tunes


def load_popularity(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return {int(r["tune_id"]): int(r["tunebooks"] or 0) for r in csv.DictReader(fh)}


def load_aliases(path):
    aliases = {}
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            tid = int(row["tune_id"])
            alias = (row["alias"] or "").strip()
            if alias:
                aliases.setdefault(tid, []).append(alias)
    return aliases


def meter_from_abc(abc):
    """La API no devuelve `meter` en la raíz: vive en la cabecera `M:` del ABC."""
    for line in (abc or "").splitlines():
        line = line.strip()
        if line.startswith("M:"):
            return line[2:].strip()
    return ""


def top_up(tunes, popularity, aliases, limit):
    """Incorpora los tunes publicados después del dump consultando la API."""
    if limit <= 0 or not tunes:
        return 0
    start = max(tunes) + 1
    added = 0
    misses = 0
    for tid in range(start, start + limit):
        raw = fetch(API_TUNE % tid, timeout=60, retries=2)
        if raw is None:
            misses += 1
            if misses >= 5:
                break
            continue
        misses = 0
        data = json.loads(raw.decode("utf-8"))
        settings = data.get("settings") or []
        if not settings:
            continue
        tunes[tid] = {
            "name": invert_name(data.get("name")),
            "type": (data.get("type") or "").strip(),
            "meter": meter_from_abc(settings[0].get("abc")),
            "composer": (data.get("composer") or "").strip(),
            "settings": len(settings),
        }
        tbk = int(data.get("tunebooks") or 0)
        if tbk:
            popularity[tid] = tbk
        alias_list = [a.strip() for a in (data.get("aliases") or []) if a.strip()]
        if alias_list:
            aliases[tid] = alias_list
        added += 1
        time.sleep(0.4)  # cortesía con la API pública
    return added


def popularity_scores(tunes, popularity):
    """Score 0-99: percentil de `tunebooks` entre los tunes con al menos uno.

    La copia de julio usaba una escala distinta e igualmente monótona en
    `tunebooks`; da igual cuál sea porque el número no se muestra en ninguna UI:
    solo ordena (tradtracker y el desempate del feeder). Lo que importa, y lo que
    se garantiza aquí, es que el orden de `popularity_score` sea el de `tunebooks`.
    """
    counts = {}
    for tid in tunes:
        tb = popularity.get(tid, 0)
        counts[tb] = counts.get(tb, 0) + 1
    positive = sum(n for tb, n in counts.items() if tb > 0)
    if positive == 0:
        return {tid: 0 for tid in tunes}

    by_tb = {}
    below = 0
    for tb in sorted(counts):
        n = counts[tb]
        if tb > 0:
            by_tb[tb] = min(99, int(round(99 * below / positive)))
            below += n
        else:
            by_tb[tb] = 0
    return {tid: by_tb[popularity.get(tid, 0)] for tid in tunes}


def build(dest, tunes, popularity, aliases, meta):
    tmp = dest + ".tmp"
    if os.path.exists(tmp):
        os.remove(tmp)
    conn = sqlite3.connect(tmp)
    try:
        conn.execute(SCHEMA_TUNES)
        for ddl in INDEXES:
            conn.execute(ddl)
        conn.execute(SCHEMA_FTS)
        scores = popularity_scores(tunes, popularity)
        rows = []
        fts = []
        for tid in sorted(tunes):
            t = tunes[tid]
            rows.append(
                (
                    tid,
                    t["name"],
                    t["type"],
                    t["meter"],
                    t["composer"],
                    popularity.get(tid, 0),
                    scores[tid],
                )
            )
            fts.append((str(tid), t["name"], " ".join(aliases.get(tid, [])), t["type"]))
        conn.executemany("INSERT INTO tunes VALUES (?,?,?,?,?,?,?)", rows)
        conn.executemany("INSERT INTO tunes_search VALUES (?,?,?,?)", fts)
        conn.commit()
        conn.execute("VACUUM")
        integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"integrity_check = {integrity}")
        fts_count = conn.execute("SELECT count(*) FROM tunes_search").fetchone()[0]
        if fts_count != len(rows):
            raise RuntimeError(f"FTS desalineado: {fts_count} vs {len(rows)}")
        bad = conn.execute("SELECT count(*) FROM tunes WHERE name IS NULL OR name = ''").fetchone()[0]
        if bad:
            raise RuntimeError(f"{bad} tunes sin nombre")
        leading_the = conn.execute("SELECT count(*) FROM tunes WHERE name LIKE 'The %'").fetchone()[0]
        if leading_the:
            raise RuntimeError(f"{leading_the} nombres conservan el artículo delante")
    finally:
        conn.close()
    os.replace(tmp, dest)

    payload = dict(meta)
    with open(dest, "rb") as fh:
        raw = fh.read()
    payload.update(
        {
            "bytes": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "tunes": len(tunes),
            "tunes_with_aliases": sum(1 for v in aliases.values() if v),
            "max_tune_id": max(tunes),
            "generated_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
            "columns": ["tune_id", "name", "type", "meter", "composer", "tunebooks", "popularity_score"],
            "popularity_note": "percentil 0-99 de tunebooks entre los tunes con >=1 tunebook; solo ordena, no se muestra",
        }
    )
    return payload


def main():
    ap = argparse.ArgumentParser(description="Regenera thesession.db desde el dump oficial")
    ap.add_argument("--cache", default=os.path.expanduser("~/.cache/tsdump"), help="directorio de descargas")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "public", "thesession.db"))
    ap.add_argument("--meta", default=None, help="sidecar de procedencia (por defecto, junto al .db)")
    ap.add_argument("--top-up", type=int, default=0, help="ids a sondear en la API por encima del dump")
    ap.add_argument("--old-db", default=None, help="copia anterior para heredar compositores que el dump omite")
    ap.add_argument("--no-download", action="store_true", help="reutiliza los CSV en --cache")
    args = ap.parse_args()

    cache = os.path.abspath(os.path.expanduser(args.cache))
    if args.no_download:
        paths = {name: os.path.join(cache, name) for name in CSV_FILES}
        missing = [p for p in paths.values() if not os.path.exists(p)]
        if missing:
            sys.exit(f"faltan ficheros en la caché: {missing}")
    else:
        log(f"Descargando el dump de {DUMP_REPO}…")
        paths = download_dump(cache)

    log("Leyendo el dump…")
    tunes = load_tunes(paths["tunes.csv"])
    popularity = load_popularity(paths["tune_popularity.csv"])
    aliases = load_aliases(paths["aliases.csv"])
    log(f"  {len(tunes)} tunes, {sum(len(v) for v in aliases.values())} alias, {len(popularity)} con tunebooks")

    added = 0
    if args.top_up:
        log(f"Top-up: sondeando hasta {args.top_up} ids por encima de {max(tunes)}…")
        added = top_up(tunes, popularity, aliases, args.top_up)
        log(f"  {added} tunes añadidos por API")

    inherited = 0
    if args.old_db and os.path.exists(args.old_db):
        conn = sqlite3.connect(args.old_db)
        old = dict(conn.execute("SELECT tune_id, composer FROM tunes"))
        conn.close()
        for tid, entry in tunes.items():
            if not entry["composer"] and old.get(tid):
                entry["composer"] = old[tid]
                inherited += 1
        log(f"  {inherited} compositores heredados de la copia anterior")

    meta = {
        "source": "dump oficial de TheSession (CSV)",
        "dump": dump_commit(),
        "top_up_added": added,
        "top_up_note": "los tunes traídos por API no traen `meter` (la API sirve el ABC sin cabecera M:); se rellena en la siguiente regeneración desde el dump",
        "composer_inherited": inherited,
    }
    out = os.path.abspath(args.out)
    log(f"Construyendo {out}…")
    payload = build(out, tunes, popularity, aliases, meta)
    meta_path = args.meta or os.path.splitext(out)[0] + ".meta.json"
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    log(
        f"OK {payload['tunes']} tunes ({payload['bytes']/1e6:.2f} MB, sha256 {payload['sha256'][:12]}…) "
        f"→ {meta_path}"
    )


if __name__ == "__main__":
    main()
