# -*- coding: utf-8 -*-
"""把 poems.tsv 按记录边界切成 4 个分片，满足 Cloudflare 单文件 < 25 MiB 的限制。"""
import argparse
import io
import os
import sys

ROOT = r"D:\Source\Repos\中国诗歌"
DATA = os.path.join(ROOT, "server", "data")
SRC = os.path.join(DATA, "poems.tsv")
PIECES = 4
LIMIT = 25 * 1024 * 1024  # 25 MiB


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--replace", action="store_true", help="写完后删除原 poems.tsv")
    ap.add_argument("--pieces", type=int, default=PIECES)
    args = ap.parse_args()

    if not os.path.exists(SRC):
        print("找不到 poems.tsv，可能已经切分。", file=sys.stderr)
        return 1

    total = os.path.getsize(SRC)
    target = total / args.pieces

    # 先按行读取，保证不切断记录
    with io.open(SRC, "r", encoding="utf-8") as f:
        rows = f.read().split("\n")
    if rows and not rows[-1]:
        rows.pop()

    shards = []
    current, current_bytes = [], 0
    for row in rows:
        b = len((row + "\n").encode("utf-8"))
        if current and current_bytes + b > target and len(shards) < args.pieces - 1:
            shards.append(current)
            current, current_bytes = [], 0
        current.append(row)
        current_bytes += b
    if current:
        shards.append(current)

    if len(shards) < args.pieces:
        # 数据很小的情况下也补齐编号
        shards.extend([[] for _ in range(args.pieces - len(shards))])

    for i, shard in enumerate(shards, 1):
        path = os.path.join(DATA, f"poems-{i:02d}.tsv")
        with io.open(path, "w", encoding="utf-8", newline="\n") as f:
            for row in shard:
                f.write(row + "\n")
        size = os.path.getsize(path)
        print(f"poems-{i:02d}.tsv  {len(shard):>7,} 首  {size/1024/1024:5.2f} MiB")
        if size >= LIMIT:
            print(f"  警告：{path} 超过 25 MiB", file=sys.stderr)
            return 2

    print(f"合计 {len(rows):,} 首，{total/1024/1024:.2f} MiB -> {len(shards)} 个分片")
    if args.replace:
        os.remove(SRC)
        print("已删除原 poems.tsv")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
