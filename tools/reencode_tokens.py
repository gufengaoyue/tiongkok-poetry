#!/usr/bin/env python3
"""Re-encode the local token index from uint32 postings to delta varints.

One-off migration for the already-built token-index.sqlite; the main builder
now writes this format directly. Also regenerates the D1 SQL chunks.
"""

from __future__ import annotations

import array
import shutil
import sqlite3
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "server" / "data"
CF = ROOT / "cloudflare"


def varint(value: int) -> bytes:
    out = bytearray()
    while value >= 0x80:
        out.append((value & 0x7f) | 0x80)
        value >>= 7
    out.append(value)
    return bytes(out)


def encode_chunks(ids: array.array) -> list[bytes]:
    chunks = []
    cur = bytearray()
    prev = 0
    first = True
    for pid in ids:
        value = pid if first else pid - prev
        raw = varint(value)
        if len(cur) + len(raw) > 44 * 1024:
            chunks.append(bytes(cur))
            cur = bytearray()
            first = True
            raw = varint(pid)
        cur.extend(raw)
        prev = pid
        first = False
    if cur:
        chunks.append(bytes(cur))
    return chunks


def main():
    db_path = DATA / "token-index.sqlite"
    db = sqlite3.connect(db_path)
    db.execute("PRAGMA journal_mode=OFF")
    db.execute("PRAGMA synchronous=OFF")

    tokens = defaultdict(list)
    rows = db.execute("SELECT token, seq, ids FROM token_index ORDER BY token, seq").fetchall()
    for token, seq, blob in rows:
        raw = bytes(blob)
        ids = array.array("I")
        for i in range(0, len(raw), 4):
            ids.append(int.from_bytes(raw[i:i + 4], "little"))
        tokens[token].extend(ids)

    db.execute("DROP TABLE token_index")
    db.execute("CREATE TABLE token_index (token TEXT NOT NULL, seq INTEGER NOT NULL, ids BLOB NOT NULL, PRIMARY KEY(token, seq))")

    sql_dir = CF / "token-index"
    if sql_dir.exists():
        shutil.rmtree(sql_dir)
    sql_dir.mkdir()

    sql_file = None
    sql_bytes = 0
    sql_no = 0
    total_rows = 0
    total_blob = 0

    def open_sql():
        nonlocal sql_file, sql_bytes, sql_no
        if sql_file:
            sql_file.close()
        sql_no += 1
        sql_file = (sql_dir / f"{sql_no:04d}.sql").open("w", encoding="utf-8")
        sql_bytes = 0

    for token in sorted(tokens):
        chunks = encode_chunks(tokens[token])
        for seq, raw in enumerate(chunks):
            total_rows += 1
            total_blob += len(raw)
            db.execute("INSERT INTO token_index(token,seq,ids) VALUES(?,?,?)", (token, seq, raw))
            stmt = f"INSERT INTO token_index(token,seq,ids) VALUES('{token}',{seq},X'{raw.hex().upper()}');\n"
            if sql_file is None or sql_bytes + len(stmt) > 8 * 1024 * 1024:
                open_sql()
            sql_file.write(stmt)
            sql_bytes += len(stmt)

    if sql_file:
        sql_file.close()
    db.commit()
    db.close()
    print("tokens", len(tokens), "rows", total_rows, "blob MiB", round(total_blob / 1024 / 1024, 1),
          "sql files", sql_no, "sql MiB",
          round(sum(p.stat().st_size for p in sql_dir.glob("*.sql")) / 1024 / 1024, 1))


if __name__ == "__main__":
    main()
