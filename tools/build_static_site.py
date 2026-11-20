#!/usr/bin/env python3
"""Build the free (static-first) Molan site data set.

Outputs:
  web/public/data/poem-index.json
  web/public/data/id-order.json
  web/public/data/poems/NNNN.json
  web/public/data/poet-index.json
  web/public/data/poet-bio/NNNN.json
  web/public/data/daily.json
  web/public/data/random.json
  web/public/data/lines.json
  web/public/data/manifest.json

Search index:
  server/data/token-index.sqlite        (local development)
  cloudflare/token-index/*.sql          (D1 Free import chunks)
  cloudflare/token-schema.sql

The D1 database stores only character / bigram postings, never poem text.
"""

from __future__ import annotations

import array
import json
import math
import re
import shutil
import sqlite3
import sys
import time
import zlib
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "server" / "data"
PUB = ROOT / "web" / "public" / "data"
CF = ROOT / "cloudflare"

SHARD_SIZE = 1000
CHAR_CHUNK = 8000
TOP_BIGRAMS = 20000
MAX_LINE_ITEMS = 240
LINE_TARGET_COUNT = 120
DEFAULT_LINE_CHARS = ["月", "风", "花", "酒", "雪", "云", "山", "江"]
CJK_RE = re.compile(r"[\u3400-\u9fff\U00020000-\U0002ffff]")


def reset_dir(path: Path) -> None:
    """Clear a generated directory, tolerating Windows holding a handle on the
    directory itself (search indexer, preview pane, antivirus). In that case the
    directory cannot be removed, but its contents can still be replaced."""
    if path.exists():
        try:
            shutil.rmtree(path)
        except PermissionError:
            for child in path.iterdir():
                if child.is_dir():
                    shutil.rmtree(child)
                else:
                    child.unlink()
    path.mkdir(exist_ok=True)

def log(*a):
    print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)

def dump(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

def tsv_files():
    files = sorted(DATA.glob("poems-*.tsv"))
    if not files:
        raise SystemExit("no poems-*.tsv found")
    return files

def read_lines(files):
    for path in files:
        with path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.rstrip("\n")
                if line:
                    yield line

def tags_string(tags):
    return "|".join(tags)

def parse_tsv(line):
    f = line.split("\x1f")
    if len(f) < 12:
        return None
    return f

def f32(text):
    try:
        return float(text) or 0.0
    except Exception:
        return 0.0

def main():
    t0 = time.time()
    files = tsv_files()
    stats = json.loads((DATA / "stats.json").read_text(encoding="utf-8"))
    authors_raw = json.loads((DATA / "authors.json").read_text(encoding="utf-8"))

    PUB.mkdir(parents=True, exist_ok=True)
    shard_dir = PUB / "poems"
    if shard_dir.exists():
        shutil.rmtree(shard_dir)
    shard_dir.mkdir()

    coll_meta = {c["code"]: c for c in stats["collections"]}
    author_meta = {}
    for a in authors_raw:
        author_meta[a["id"]] = {
            "id": a["id"], "name": a.get("name", ""), "dynasty": a.get("dynasty", ""),
            "charCount": int(a.get("charCount") or 0),
            "bio": a.get("bio", ""), "shortBio": a.get("shortBio", ""),
            "collections": list(a.get("collections") or []),
        }
    author_key = {(a["name"], a["dynasty"]): a["id"] for a in authors_raw}
    work_count = defaultdict(int)
    author_len = defaultdict(int)
    author_chars = defaultdict(Counter)
    author_colls = defaultdict(set)

    daily_pool = list(stats.get("dailyPool") or [])
    daily_set = set(daily_pool)
    daily_items = {}
    random_ids = []

    rows = []
    char_postings = defaultdict(lambda: array.array("I"))
    bigram_counts = defaultdict(int)

    shard_fh = None
    shard_no = 0

    def open_shard(no):
        nonlocal shard_fh, shard_no
        if shard_fh:
            shard_fh.write("]")
            shard_fh.close()
        shard_no = no
        shard_fh = (shard_dir / f"{no:04d}.json").open("w", encoding="utf-8")
        shard_fh.write("[")

    idx = 0
    total_lines = 0
    total_chars = 0
    log("pass 1: index, shards, character postings, bigram counts")
    for line in read_lines(files):
        f = parse_tsv(line)
        if not f:
            continue
        pid, coll, dyn, author, title, raw_content, raw_tags, rhythm, sub, raw_notes, pro, pop = f[:12]
        content = raw_content.replace("\x02", "\n")
        tags = raw_tags.split("\x03") if raw_tags else []
        notes = raw_notes.split("\x02") if raw_notes else []
        p_len = len(content) - content.count("\n")
        p_lines = content.count("\n") + 1
        total_lines += p_lines
        total_chars += p_len
        anth = 1 if ("唐诗三百首" in tags or "宋词三百首" in tags) else 0
        cname = coll_meta.get(coll, {}).get("name", coll)

        aid = author_key.get((author, dyn))
        if not aid:
            aid = "x-" + str(zlib.crc32((author + "|" + dyn).encode("utf-8")))
            if aid not in author_meta:
                author_meta[aid] = {
                    "id": aid, "name": author, "dynasty": dyn, "charCount": 0,
                    "bio": "", "shortBio": "", "collections": [],
                }
                author_key[(author, dyn)] = aid
        work_count[aid] += 1
        author_len[aid] += p_len
        author_colls[aid].add(coll)
        for ch in CJK_RE.findall(content):
            if "\u4e00" <= ch <= "\u9fff" or ord(ch) > 0x20000:
                author_chars[aid][ch] += 1

        if idx % SHARD_SIZE == 0:
            open_shard(idx // SHARD_SIZE + 1)
        shard = idx // SHARD_SIZE + 1
        rec = [pid, title, author, dyn, coll, cname, rhythm, tags_string(tags),
               content, notes, pro, f32(pop), aid]
        if idx % SHARD_SIZE:
            shard_fh.write(",")
        shard_fh.write(json.dumps(rec, ensure_ascii=False, separators=(",", ":")))

        row = [pid, title, author, dyn, coll, cname, rhythm, tags_string(tags),
               p_len, p_lines, f32(pop), anth, aid, shard,
               content.split("\n")[:2][0] + (" " + content.split("\n")[1] if content.count("\n") else "")]
        row[-1] = row[-1][:28]
        rows.append(row)
        random_ids.append(pid)

        # Character postings from title + content.
        cjk = CJK_RE.findall(title + content)
        for ch in set(cjk):
            char_postings[ch].append(idx)
        for a, b in zip(cjk, cjk[1:]):
            bigram_counts[a + b] += 1

        if pid in daily_set:
            daily_items[pid] = [pid, title, author, dyn, cname, rhythm,
                                content.split("\n"), tags_string(tags), f32(pop)]

        idx += 1
        if idx % 50000 == 0:
            log(f"  {idx:,} poems")

    if shard_fh:
        shard_fh.write("]")
        shard_fh.close()

    if idx == 0:
        raise SystemExit("no poems parsed")
    log(f"pass 1 done: {idx:,} poems, {len(rows):,} rows, {len(char_postings):,} chars, {len(bigram_counts):,} bigrams")

    # Bigram selection: document frequency, not raw frequency.
    top_bigrams = sorted(bigram_counts.items(), key=lambda kv: kv[1], reverse=True)[:TOP_BIGRAMS]
    top_bigram_set = {g for g, _ in top_bigrams}
    log(f"selected top {len(top_bigrams):,} bigrams, postings {sum(n for _, n in top_bigrams):,}")

    # Pass 2: bigram postings + fly-flower line pools.
    line_chars = [it["c"] for it in stats.get("chars", [])[:LINE_TARGET_COUNT]]
    for c in DEFAULT_LINE_CHARS:
        if c not in line_chars:
            line_chars.append(c)
    line_targets = set(line_chars)
    line_entries = {c: [] for c in line_targets}
    line_seen = {c: set() for c in line_targets}
    line_totals = {c: 0 for c in line_targets}
    bigram_postings = defaultdict(lambda: array.array("I"))

    idx = 0
    log(f"pass 2: bigram postings + {len(line_chars)} fly-flower characters")
    for line in read_lines(files):
        f = parse_tsv(line)
        if not f:
            continue
        pid, coll, dyn, author, title, raw_content, raw_tags, rhythm, sub, raw_notes, pro, pop = f[:12]
        content = raw_content.replace("\x02", "\n")
        cjk = CJK_RE.findall(title + content)
        pairs = {a + b for a, b in zip(cjk, cjk[1:])}
        for pair in pairs:
            if pair in top_bigram_set:
                bigram_postings[pair].append(idx)

        present = set(CJK_RE.findall(content))
        for ch in line_targets:
            if ch not in present:
                continue
            first = ""
            for ln in content.split("\n"):
                if ch in ln:
                    first = ln
                    break
            if not first or first in line_seen[ch]:
                continue
            line_seen[ch].add(first)
            line_totals[ch] += 1
            r = rows[idx]
            line_entries[ch].append([first, pid, r[1], r[2], r[3], r[4], r[10], r[11]])

        idx += 1
        if idx % 100000 == 0:
            log(f"  {idx:,} poems")

    # Build line JSON with the same ranking rules as server/index.js.
    line_out = {}
    for ch in line_chars:
        pool = line_entries.get(ch, [])
        pool.sort(key=lambda x: (-x[7], -x[6], x[2], x[0]))
        picked = []
        per_author = Counter()
        for it in pool:
            if len(picked) >= MAX_LINE_ITEMS:
                break
            if per_author[it[3]] >= 2:
                continue
            per_author[it[3]] += 1
            picked.append({"line": it[0], "id": it[1], "title": it[2],
                           "author": it[3], "dynasty": it[4], "coll": it[5]})
        line_out[ch] = {"total": line_totals[ch], "items": picked}
    log(f"fly-flower lines built: {len(line_out)} characters")

    # Author metadata / poet index.
    poet_rows = []
    for aid, meta in author_meta.items():
        n = work_count.get(aid, 0)
        if n <= 0:
            continue
        chars = author_chars.get(aid)
        top = []
        if chars:
            top = [[c, n2] for c, n2 in chars.most_common(24)]
        colls = sorted(set(meta.get("collections") or []) | author_colls.get(aid, set()))
        brief = (meta.get("shortBio") or "")[:64]
        char_count = meta.get("charCount") or author_len.get(aid, 0)
        poet_rows.append([aid, meta.get("name", ""), meta.get("dynasty", ""), n,
                          char_count, "|".join(colls), brief, "|".join(f"{c}:{k}" for c, k in top)])

    stats["totals"]["authors"] = len(poet_rows)

    # Static files. The poem index is split so every file stays below the
    # 25 MiB Workers Static Assets per-file limit.
    index_parts = 8
    part_size = math.ceil(len(rows) / index_parts)
    parts_meta = []
    for i in range(index_parts):
        start = i * part_size
        end = min(len(rows), start + part_size)
        if start >= end:
            continue
        name = f"poem-index-{i:03d}.json"
        dump(PUB / name, rows[start:end])
        parts_meta.append({"file": name, "count": end - start})
    dump(PUB / "poem-index.json", {"total": len(rows), "parts": parts_meta})
    dump(PUB / "id-order.json", sorted(range(len(rows)), key=lambda i: rows[i][0]))
    dump(PUB / "poet-index.json", poet_rows)
    dump(PUB / "daily.json", [daily_items[i] for i in daily_pool if i in daily_items])
    dump(PUB / "random.json", random_ids)
    # 飞花令按字拆文件：首页只取「月」一个文件，不再下载整张表。
    lines_dir = PUB / "lines"
    reset_dir(lines_dir)
    for ch, data in line_out.items():
        dump(lines_dir / f"{ch}.json", data)
    dump(PUB / "stats.json", stats)
    shutil.copyfile(DATA / "classics.json", PUB / "classics.json")
    shutil.copyfile(DATA / "s2t.json", PUB / "s2t.json")

    # Poet bio shards: only one shard is loaded by a poet page.
    bio_dir = PUB / "poet-bio"
    reset_dir(bio_dir)
    groups = defaultdict(dict)
    for aid, meta in author_meta.items():
        if work_count.get(aid, 0) <= 0:
            continue
        m = re.match(r"a-(\d+)", aid)
        if m:
            group = f"{int(m.group(1)) // 1000:04d}"
        else:
            group = "x"
        groups[group][aid] = {"bio": meta.get("bio", ""), "shortBio": meta.get("shortBio", "")}
    for group, items in groups.items():
        dump(bio_dir / f"{group}.json", items)

    # Search token index SQL + local SQLite.
    token_dir = CF / "token-index"
    if token_dir.exists():
        shutil.rmtree(token_dir)
    token_dir.mkdir()
    (CF / "token-schema.sql").write_text(
        "DROP TABLE IF EXISTS token_index;\n"
        "CREATE TABLE token_index (token TEXT NOT NULL, seq INTEGER NOT NULL, ids BLOB NOT NULL, PRIMARY KEY(token, seq));\n",
        encoding="utf-8",
    )

    db_path = DATA / "token-index.sqlite"
    if db_path.exists():
        db_path.unlink()
    db = sqlite3.connect(db_path)
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("PRAGMA synchronous=OFF")
    db.execute("DROP TABLE IF EXISTS token_index")
    db.execute("CREATE TABLE token_index (token TEXT NOT NULL, seq INTEGER NOT NULL, ids BLOB NOT NULL, PRIMARY KEY(token, seq))")

    sql_file = None
    sql_bytes = 0
    sql_no = 0
    token_rows = 0
    token_bytes = 0

    def open_sql():
        nonlocal sql_file, sql_bytes, sql_no
        if sql_file:
            sql_file.close()
        sql_no += 1
        sql_file = (token_dir / f"{sql_no:04d}.sql").open("w", encoding="utf-8")
        sql_bytes = 0

    def emit_token(token, arr):
        nonlocal sql_file, sql_bytes, token_rows, token_bytes
        chunks = []
        cur = bytearray()
        prev = 0
        first = True
        for pid in arr:
            value = pid if first else pid - prev
            raw = bytearray()
            while value >= 0x80:
                raw.append((value & 0x7f) | 0x80)
                value >>= 7
            raw.append(value)
            if len(cur) + len(raw) > 44 * 1024:
                chunks.append(cur)
                cur = bytearray()
                first = True
                value = pid
                raw = bytearray()
                while value >= 0x80:
                    raw.append((value & 0x7f) | 0x80)
                    value >>= 7
                raw.append(value)
            cur.extend(raw)
            prev = pid
            first = False
        if cur:
            chunks.append(cur)

        for seq, raw in enumerate(chunks):
            token_bytes += len(raw)
            hexs = raw.hex().upper()
            stmt = f"INSERT INTO token_index(token,seq,ids) VALUES('{token}',{seq},X'{hexs}');\n"
            db.execute("INSERT INTO token_index(token,seq,ids) VALUES(?,?,?)", (token, seq, raw))
            if sql_file is None or sql_bytes + len(stmt) > 8 * 1024 * 1024:
                open_sql()
            sql_file.write(stmt)
            sql_bytes += len(stmt)
            token_rows += 1

    for ch, arr in sorted(char_postings.items()):
        emit_token("c:" + ch, arr)
    for gram, _ in top_bigrams:
        arr = bigram_postings.get(gram)
        if arr:
            emit_token("b:" + gram, arr)

    if sql_file:
        sql_file.close()
    db.commit()
    db.close()

    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "poems": len(rows),
        "authors": len(poet_rows),
        "lines": total_lines,
        "chars": total_chars,
        "contentShards": (len(rows) + SHARD_SIZE - 1) // SHARD_SIZE,
        "indexParts": len(parts_meta),
        "lineChars": len(line_out),
        "charTokens": len(char_postings),
        "bigramTokens": len(top_bigrams),
        "tokenRows": token_rows,
        "tokenBytes": token_bytes,
        "topBigrams": len(top_bigrams),
        "shardSize": SHARD_SIZE,
        "daily": len(daily_items),
    }
    dump(PUB / "manifest.json", manifest)

    log(f"done in {time.time() - t0:.1f}s")
    log(f"poems={len(rows):,} shards={manifest['contentShards']} poets={len(poet_rows):,}")
    log(f"token rows={token_rows:,} blob={token_bytes/1024/1024:.1f} MiB sql files={sql_no}")
    log(f"poem-index.json={(PUB/'poem-index.json').stat().st_size/1024/1024:.1f} MiB")
    log(f"sqlite={(db_path.stat().st_size / 1024 / 1024):.1f} MiB")

if __name__ == "__main__":
    main()
