#!/usr/bin/env python3
"""Build the browser-side range index from the SQLite token index.

The D1/local SQLite index stores postings in several seq chunks per token.
Each chunk starts with an absolute poem index and continues with delta
varints.  For HTTP Range access we need one contiguous stream per token,
so this script decodes the chunks, joins them, and writes:

  web/public/data/token-index.bin
  web/public/data/token-offsets.json

GitHub Pages / any static host that supports Range can then serve a few
kilobytes per query instead of the whole 30+ MiB index.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "server" / "data" / "token-index.sqlite"
OUT = ROOT / "web" / "public" / "data"


def decode_ids(raw: bytes) -> list[int]:
    out: list[int] = []
    value = 0
    shift = 0
    prev = 0
    first = True
    for byte in raw:
        value += (byte & 0x7f) << shift
        if byte & 0x80:
            shift += 7
            continue
        if first:
            prev = value
            first = False
        else:
            prev += value
        out.append(prev)
        value = 0
        shift = 0
    return out


def encode_ids(ids: list[int]) -> bytes:
    out = bytearray()
    prev = 0
    first = True
    for pid in ids:
        value = pid if first else pid - prev
        if value < 0:
            raise ValueError("postings are not sorted")
        while value >= 0x80:
            out.append((value & 0x7f) | 0x80)
            value >>= 7
        out.append(value)
        prev = pid
        first = False
    return bytes(out)


def main() -> None:
    if not DB.exists():
        raise SystemExit(f"missing {DB}; run tools/build_static_site.py first")

    db = sqlite3.connect(DB)
    rows = db.execute(
        "SELECT token, seq, ids FROM token_index ORDER BY token, seq"
    ).fetchall()
    db.close()

    OUT.mkdir(parents=True, exist_ok=True)
    bin_path = OUT / "token-index.bin"
    offsets: list[list[object]] = []
    total_ids = 0

    with bin_path.open("wb") as f:
        current_token = None
        current_ids: list[int] = []

        def flush() -> None:
            nonlocal total_ids
            if current_token is None:
                return
            # Chunks already contain disjoint, sorted ranges; still sort to
            # make the browser intersection safe if import order ever changes.
            ids = sorted(set(current_ids))
            raw = encode_ids(ids)
            off = f.tell()
            f.write(raw)
            offsets.append([current_token, off, len(raw)])
            total_ids += len(ids)

        for token, _seq, blob in rows:
            if token != current_token:
                flush()
                current_token = token
                current_ids = []
            current_ids.extend(decode_ids(blob))
        flush()

    with (OUT / "token-offsets.json").open("w", encoding="utf-8") as f:
        json.dump(offsets, f, ensure_ascii=False, separators=(",", ":"))

    bin_size = bin_path.stat().st_size
    off_size = (OUT / "token-offsets.json").stat().st_size
    print(
        f"tokens={len(offsets):,} postings={total_ids:,} "
        f"bin={bin_size/1024/1024:.1f} MiB offsets={off_size/1024/1024:.1f} MiB"
    )
    manifest_path = OUT / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["rangeIndexBytes"] = bin_size
        manifest["rangeOffsetBytes"] = off_size
        manifest["rangePostings"] = total_ids
        manifest["rangeTokens"] = len(offsets)
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
