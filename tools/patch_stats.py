# -*- coding: utf-8 -*-
"""补充：从语料中提取标签、词牌完整清单，写入 stats.json。"""
import io, json, os
from collections import Counter

OUT = r"D:\Source\Repos\中国诗歌\server\data"
stats = json.load(io.open(os.path.join(OUT, "stats.json"), encoding="utf-8"))

tags = Counter()
rhythms = Counter()
for line in io.open(os.path.join(OUT, "poems.tsv"), encoding="utf-8"):
    f = line.rstrip("\n").split("\x1f")
    if len(f) < 12:
        continue
    if f[6]:
        for t in f[6].split("\x03"):
            tags[t] += 1
    if f[7]:
        rhythms[f[7]] += 1

stats["tags"] = [dict(name=k, count=v) for k, v in tags.most_common(80)]
stats["rhythms"] = [dict(name=k, count=v) for k, v in rhythms.most_common(200)]
json.dump(stats, io.open(os.path.join(OUT, "stats.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
print("tags", len(stats["tags"]), "rhythms", len(stats["rhythms"]))
print([t["name"] for t in stats["tags"][:20]])
