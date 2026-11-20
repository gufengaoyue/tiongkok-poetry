# -*- coding: utf-8 -*-
"""把 D1 种子 SQL 按完整 INSERT 语句切成小块，避免单文件过大导致导入卡住。

生成器写的种子中，每条 INSERT 都从行首开始，因此可以安全地按
"\\nINSERT INTO " 边界切分。切分只改变文件边界，不改动任何 SQL 内容。

用法：
    python tools/split_d1_sql.py
    python tools/split_d1_sql.py --max-mb 8
"""
import argparse
import glob
import io
import os
import shutil

ROOT = r"D:\Source\Repos\中国诗歌"
SEED = os.path.join(ROOT, "cloudflare", "seed")
OUT = os.path.join(SEED, "chunks")


def load_statements(path):
    data = io.open(path, "r", encoding="utf-8", newline="").read()
    marker = "\nINSERT INTO "
    parts = data.split(marker)
    statements = []
    if parts[0].strip():
        statements.append(parts[0])
    for part in parts[1:]:
        statements.append("INSERT INTO " + part)
    return statements


def split_file(path, outdir, max_bytes):
    name = os.path.splitext(os.path.basename(path))[0]
    os.makedirs(outdir, exist_ok=True)
    index = 1
    current = []
    current_size = 0

    def flush():
        nonlocal index, current, current_size
        if not current:
            return
        target = os.path.join(outdir, f"{name}-{index:03d}.sql")
        with io.open(target, "w", encoding="utf-8", newline="\n") as out:
            out.write("".join(current))
        print(f"  {os.path.basename(target)}  {os.path.getsize(target) / 1024 / 1024:.2f} MiB")
        index += 1
        current = []
        current_size = 0

    for statement in load_statements(path):
        size = len(statement.encode("utf-8"))
        if current and current_size + size > max_bytes:
            flush()
        current.append(statement)
        current_size += size
    flush()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-mb", type=float, default=8.0)
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()
    max_bytes = int(args.max_mb * 1024 * 1024)

    files = sorted(p for p in glob.glob(os.path.join(SEED, "*.sql")) if os.path.isfile(p))
    if not files:
        raise SystemExit("找不到 cloudflare/seed/*.sql，请先生成种子。")

    if os.path.isdir(args.out):
        shutil.rmtree(args.out)
    os.makedirs(args.out, exist_ok=True)

    for path in files:
        print(os.path.basename(path))
        split_file(path, args.out, max_bytes)
    print(f"完成：输出目录 {args.out}")


if __name__ == "__main__":
    main()
