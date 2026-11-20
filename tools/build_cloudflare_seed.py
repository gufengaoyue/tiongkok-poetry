# -*- coding: utf-8 -*-
"""从 server/data 生成 Cloudflare D1 种子 SQL，可选构建本地 SQLite 验证库。

用法：
    python tools/build_cloudflare_seed.py
    python tools/build_cloudflare_seed.py --sqlite cloudflare/molan.sqlite
"""
import argparse
import glob
import io
import json
import os
import sqlite3
import sys
import urllib.parse

ROOT = r"D:\Source\Repos\中国诗歌"
DATA = os.path.join(ROOT, "server", "data")
SCHEMA = os.path.join(ROOT, "cloudflare", "schema.sql")
LINE_CHARS = "月风花酒雪云山江"
BATCH = 100


def sql_text(value):
    return "'" + str(value).replace("'", "''") + "'"


def spaced(text):
    """把中文逐字加空格，供 FTS5 unicode61 phrase 查询。"""
    return " ".join(list(str(text).replace("\n", " ").replace("\x02", " ")))


def read_poems():
    files = sorted(glob.glob(os.path.join(DATA, "poems-*.tsv")))
    if not files:
        single = os.path.join(DATA, "poems.tsv")
        if not os.path.exists(single):
            raise SystemExit("找不到 poems-*.tsv 或 poems.tsv，请先运行数据管线。")
        files = [single]
    for file in files:
        with io.open(file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.rstrip("\n")
                if line:
                    yield line.split("\x1f")


def poem_row(fields):
    if len(fields) < 12:
        return None
    id_, coll, dyn, author, title, content, tags, rhythm, sub, notes, pro, pop = fields[:12]
    tag_list = tags.split("\x03") if tags else []
    notes_list = notes.split("\x02") if notes else []
    return {
        "id": id_, "coll": coll, "dynasty": dyn, "author": author, "title": title,
        "content": content.replace("\x02", "\n"), "tags": json.dumps(tag_list, ensure_ascii=False),
        "rhythm": rhythm or "", "sub": sub or "",
        "notes": json.dumps(notes_list, ensure_ascii=False), "prologue": pro or "",
        "popularity": float(pop or 0), "len": len(content),
        "lines": content.count("\x02") + 1,
        "anth": 1 if ("唐诗三百首" in tag_list or "宋词三百首" in tag_list) else 0,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "cloudflare", "seed"))
    ap.add_argument("--sqlite", default="")
    args = ap.parse_args()

    authors = json.load(io.open(os.path.join(DATA, "authors.json"), encoding="utf-8"))
    lookup = {f"{a['name']}|{a['dynasty']}": a for a in authors}
    for a in authors:
        a["_count"] = 0

    # 第一遍：统计每位诗人的实际作品数，并建立未知作者的临时档案
    total_poems = 0
    for fields in read_poems():
        row = poem_row(fields)
        if not row:
            continue
        total_poems += 1
        key = f"{row['author']}|{row['dynasty']}"
        a = lookup.get(key)
        if a:
            a["_count"] += 1
        else:
            lookup[key] = {
                "id": "x-" + urllib.parse.quote(row["author"]),
                "name": row["author"], "dynasty": row["dynasty"],
                "poemCount": 0, "charCount": 0, "collections": [],
                "bio": "", "shortBio": "", "_count": 1,
            }

    os.makedirs(args.out, exist_ok=True)
    conn = None
    if args.sqlite:
        os.makedirs(os.path.dirname(os.path.abspath(args.sqlite)), exist_ok=True)
        if os.path.exists(args.sqlite):
            os.remove(args.sqlite)
        conn = sqlite3.connect(args.sqlite)
        conn.execute("PRAGMA journal_mode=OFF")
        conn.execute("PRAGMA synchronous=OFF")
        conn.executescript(io.open(SCHEMA, encoding="utf-8").read())

    # 诗人
    author_path = os.path.join(args.out, "010-authors.sql")
    with io.open(author_path, "w", encoding="utf-8", newline="\n") as f:
        for i in range(0, len(authors), BATCH):
            chunk = authors[i:i + BATCH]
            vals = []
            for a in chunk:
                vals.append("(" + ",".join([
                    sql_text(a["id"]), sql_text(a["name"]), sql_text(a["dynasty"]),
                    str(a["_count"]), str(int(a.get("charCount") or 0)),
                    sql_text(json.dumps(a.get("collections") or [], ensure_ascii=False)),
                    sql_text(a.get("bio") or ""), sql_text(a.get("shortBio") or ""),
                ]) + ")")
                a["_poem_count"] = a["_count"]
            f.write("INSERT INTO authors (id,name,dynasty,poem_count,char_count,collections,bio,short_bio) VALUES\n"
                    + ",\n".join(vals) + ";\n")
        if conn:
            conn.executemany(
                "INSERT INTO authors (id,name,dynasty,poem_count,char_count,collections,bio,short_bio) VALUES (?,?,?,?,?,?,?,?)",
                [(a["id"], a["name"], a["dynasty"], a["_count"], int(a.get("charCount") or 0),
                  json.dumps(a.get("collections") or [], ensure_ascii=False),
                  a.get("bio") or "", a.get("shortBio") or "") for a in authors],
            )
            conn.commit()

    # 分片写诗，同时收集飞花令候选
    line_candidates = {ch: {} for ch in LINE_CHARS}
    poem_files = sorted(glob.glob(os.path.join(DATA, "poems-*.tsv")))
    if not poem_files:
        poem_files = [os.path.join(DATA, "poems.tsv")]

    for index, path in enumerate(poem_files, 1):
        out_path = os.path.join(args.out, f"020-poems-{index:02d}.sql")
        poem_vals, fts_vals = [], []
        with io.open(path, "r", encoding="utf-8") as src, io.open(out_path, "w", encoding="utf-8", newline="\n") as out:
            def flush():
                nonlocal poem_vals, fts_vals
                if not poem_vals:
                    return
                out.write("INSERT INTO poems (id,coll,dynasty,author,title,content,tags,rhythm,sub,notes,prologue,popularity,len,lines,anth,aid) VALUES\n"
                          + ",\n".join(poem_vals) + ";\n")
                out.write("INSERT INTO poems_fts (pid,title,author,body,tags,rhythm) VALUES\n"
                          + ",\n".join(fts_vals) + ";\n")
                if conn:
                    conn.executemany(
                        "INSERT INTO poems (id,coll,dynasty,author,title,content,tags,rhythm,sub,notes,prologue,popularity,len,lines,anth,aid) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        [tuple(json.loads(v)) for v in poem_vals],
                    )
                    conn.executemany(
                        "INSERT INTO poems_fts (pid,title,author,body,tags,rhythm) VALUES (?,?,?,?,?,?)",
                        [tuple(json.loads(v)) for v in fts_vals],
                    )
                poem_vals, fts_vals = [], []

            for line in src:
                line = line.rstrip("\n")
                if not line:
                    continue
                row = poem_row(line.split("\x1f"))
                if not row:
                    continue
                key = f"{row['author']}|{row['dynasty']}"
                a = lookup[key]
                row["aid"] = a["id"]
                rid_fields = [row["id"], row["coll"], row["dynasty"], row["author"], row["title"],
                              row["content"], row["tags"], row["rhythm"], row["sub"], row["notes"],
                              row["prologue"], row["popularity"], row["len"], row["lines"], row["anth"], row["aid"]]
                poem_vals.append(json.dumps(rid_fields, ensure_ascii=False))
                fts_vals.append(json.dumps([row["id"], spaced(row["title"]), spaced(row["author"]),
                                           spaced(row["content"]), spaced(row["tags"]), spaced(row["rhythm"])],
                                          ensure_ascii=False))

                for ch in LINE_CHARS:
                    if ch not in row["content"]:
                        continue
                    first = next((ln for ln in row["content"].split("\n") if ch in ln), "")
                    if first and first not in line_candidates[ch]:
                        line_candidates[ch][first] = {
                            "line": first, "id": row["id"], "title": row["title"],
                            "author": row["author"], "dynasty": row["dynasty"], "coll": row["coll"],
                            "anth": row["anth"], "pop": row["popularity"],
                        }
                if len(poem_vals) >= BATCH:
                    flush()
            flush()
            print(f"  {os.path.basename(out_path)}  {os.path.getsize(out_path)/1024/1024:.1f} MiB")
        if conn:
            conn.commit()

    # 飞花令：名篇优先，作者最多两条
    line_path = os.path.join(args.out, "030-lines.sql")
    with io.open(line_path, "w", encoding="utf-8", newline="\n") as f:
        for ch in LINE_CHARS:
            candidates = list(line_candidates[ch].values())
            candidates.sort(key=lambda x: (-x["anth"], -x["pop"]))
            picked, per_author = [], {}
            for item in candidates:
                if len(picked) >= 240:
                    break
                n = per_author.get(item["author"], 0)
                if n >= 2:
                    continue
                per_author[item["author"]] = n + 1
                picked.append(item)
            char_total = len(candidates)
            f.write(f"INSERT INTO line_stats (ch,total) VALUES ({sql_text(ch)},{char_total});\n")
            batch = []
            for rank, item in enumerate(picked):
                batch.append("(" + ",".join([
                    sql_text(ch), str(rank), sql_text(item["line"]), sql_text(item["id"]),
                    sql_text(item["title"]), sql_text(item["author"]),
                    sql_text(item["dynasty"]), sql_text(item["coll"]),
                ]) + ")")
                if len(batch) >= BATCH:
                    f.write("INSERT INTO lines (ch,rank,line,poem_id,title,author,dynasty,coll) VALUES\n"
                            + ",\n".join(batch) + ";\n")
                    batch = []
            if batch:
                f.write("INSERT INTO lines (ch,rank,line,poem_id,title,author,dynasty,coll) VALUES\n"
                        + ",\n".join(batch) + ";\n")
            if conn:
                conn.executemany(
                    "INSERT INTO lines (ch,rank,line,poem_id,title,author,dynasty,coll) VALUES (?,?,?,?,?,?,?,?)",
                    [(ch, rank, item["line"], item["id"], item["title"], item["author"],
                      item["dynasty"], item["coll"]) for rank, item in enumerate(picked)],
                )
                conn.execute("INSERT INTO line_stats (ch,total) VALUES (?,?)", (ch, char_total))
            print(f"  飞花令 {ch}: {char_total:,} 条 -> {len(picked)} 条")

    print(f"完成：{total_poems:,} 首，种子目录 {args.out}")
    if conn:
        conn.commit()
        conn.close()
        print(f"SQLite 验证库：{args.sqlite}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
