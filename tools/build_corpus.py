# -*- coding: utf-8 -*-
"""
构建「墨澜 · MOLAN」站点所需的结构化诗词数据。

输入：D:\\Source\\Repos\\chinese-poetry 原始 JSON
输出：server/data/ 下的紧凑 TSV / JSON
"""
import io, json, math, os, re, sys, time, heapq
from collections import Counter, defaultdict
from opencc import OpenCC

BASE = r"D:\Source\Repos\chinese-poetry"
OUT = r"D:\Source\Repos\中国诗歌\server\data"
os.makedirs(OUT, exist_ok=True)

cc = OpenCC("t2s")
t0 = time.time()

SEP_F = "\x1f"
SEP_L = "\x02"
SEP_T = "\x03"


def log(*a):
    print(f"[{time.time()-t0:6.1f}s]", *a)


def s2(text):
    return cc.convert(str(text)) if text else ""


# 全唐诗原始文本里有一部分生僻字以 {上休下鳥} 这类结构式保存。
# 表面结构字.json 给出了其中一部分字对应的 Unicode 字形，构建时替换回真实字符；
# 没有 Unicode 编码的条目保持原结构式，至少仍可读出部件，不会显示成豆腐块。
RARE_FILE = os.path.join(BASE, "全唐诗", "表面结构字.json")
RARE_MAP = {}
try:
    with io.open(RARE_FILE, "r", encoding="utf-8") as _f:
        _rare = json.load(_f)
    RARE_MAP = {k: v[0]["font"] for k, v in _rare.items()
                if v and isinstance(v, list) and v[0].get("font")}
except Exception as _err:
    log("! 表面结构字表未载入：", _err)

RARE_PATTERN = re.compile(r"\{[^{}\n]{1,20}\}")


def restore_rare(text):
    return RARE_PATTERN.sub(lambda m: RARE_MAP.get(m.group(0), m.group(0)), str(text))


def clean(text):
    text = str(text).replace("\r", " ").replace("\u3000", " ")
    text = re.sub(r"[ \t]+", " ", text).strip()
    return text


def simp(text):
    return restore_rare(clean(s2(text)))


def load(path):
    with io.open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def files_by(pattern):
    fs = glob.glob(os.path.join(BASE, pattern))
    return sorted(fs, key=lambda p: int(re.findall(r"\d+", os.path.basename(p))[-1]) if re.findall(r"\d+", os.path.basename(p)) else 0)


import glob

COLLECTIONS = [
    dict(code="tang", name="全唐诗", short="唐诗", dynasty="唐", era="618—907",
         desc="清康熙年间编纂的唐诗总集，收录二千二百余位诗人，是唐诗最完整的传世文本。"),
    dict(code="songshi", name="全宋诗", short="宋诗", dynasty="宋", era="960—1279",
         desc="两宋三百年诗歌的总汇，数量十倍于唐诗，日常、理趣与哲思构成它的底色。"),
    dict(code="songci", name="全宋词", short="宋词", dynasty="宋", era="960—1279",
         desc="词至宋而极盛，长短句间有婉约的低语，也有豪放的浩歌，是中国抒情传统的巅峰。"),
    dict(code="yuanqu", name="元曲", short="元曲", dynasty="元", era="1271—1368",
         desc="散曲与杂剧合流，以俚俗鲜活的语言、跌宕的曲牌，写尽市井与人生的悲欢。"),
    dict(code="shijing", name="诗经", short="诗经", dynasty="先秦", era="前11—前6世纪",
         desc="中国最早的诗歌总集，风雅颂三百零五篇，是汉语抒情传统最初的源。"),
    dict(code="chuci", name="楚辞", short="楚辞", dynasty="先秦", era="战国",
         desc="以屈原为代表的南方歌诗，香草美人的意象与瑰丽奇崛的想象，开出另一条诗歌血脉。"),
    dict(code="huajian", name="花间集", short="花间", dynasty="五代", era="940",
         desc="后蜀赵崇祚编选的词集，温庭筠以下十八家，词为艳科的审美在此定型。"),
    dict(code="nantang", name="南唐二主词", short="南唐", dynasty="五代", era="937—975",
         desc="李璟、李煜父子的词作，亡国之痛化作一江春水，词境自此由伶工之词变为士大夫之词。"),
    dict(code="qianjia", name="千家诗", short="千家", dynasty="宋", era="宋—明",
         desc="旧时蒙学读本，选唐宋近体诗二百余首，是无数人最初的诗教。"),
    dict(code="shuimo", name="水墨唐诗", short="水墨", dynasty="唐", era="618—907",
         desc="精选唐诗一百七十六首，每首附白话释义，旧时启蒙读物。"),
    dict(code="nalan", name="纳兰词", short="纳兰", dynasty="清", era="1655—1685",
         desc="清初词人纳兰性德的作品，以真性情写悼亡与边塞，被誉为「满清第一词人」。"),
    dict(code="caocao", name="曹操诗集", short="曹操", dynasty="汉", era="155—220",
         desc="建安风骨的开创者，四言古直悲凉，开一代气象。"),
]

DYNASTY_RANGE = {
    "先秦": "前11世纪—前3世纪",
    "汉": "前202—220",
    "唐": "618—907",
    "五代": "907—979",
    "宋": "960—1279",
    "元": "1271—1368",
    "清": "1644—1912",
}
DYNASTY_ORDER = ["先秦", "汉", "唐", "五代", "宋", "元", "清"]

coll_counter = Counter()
author_stats = defaultdict(lambda: dict(count=0, chars=0, colls=set()))
tag_counter = Counter()
rhythmic_counter = Counter()
char_counter = Counter()
dynasty_counter = Counter()
length_hist = Counter()
top_pop = []
total_lines = 0
total_chars = 0
total_poems = 0

tsv = io.open(os.path.join(OUT, "poems.tsv"), "w", encoding="utf-8", newline="\n")


def add_poem(coll, dynasty, author, title, lines, tags=None, rhythmic="", sub="",
             notes=None, prologue="", popularity=0.0):
    global total_lines, total_chars, total_poems
    lines = [simp(x) for x in lines]
    lines = [x for x in lines if x]
    if not lines:
        return None
    author = simp(author) or "佚名"
    title = simp(title) or simp(rhythmic) or "无题"
    rhythmic = simp(rhythmic)
    sub = simp(sub)
    tags = [simp(t) for t in (tags or []) if clean(t)]
    notes = [simp(n) for n in (notes or []) if clean(n)]
    prologue = simp(prologue)

    idx = coll_counter[coll]
    coll_counter[coll] = idx + 1
    pid = f"{coll}-{idx + 1:05d}"

    text = "".join(lines)
    nchars = len(text)

    fields = [
        pid, coll, dynasty, author, title,
        SEP_L.join(lines),
        SEP_T.join(tags),
        rhythmic, sub,
        SEP_L.join(notes),
        prologue,
        str(round(float(popularity), 2)),
    ]
    tsv.write(SEP_F.join(fields) + "\n")

    total_poems += 1
    total_lines += len(lines)
    total_chars += nchars

    st = author_stats[(author, dynasty)]
    st["count"] += 1
    st["chars"] += nchars
    st["colls"].add(coll)

    for t in tags:
        tag_counter[t] += 1
    if rhythmic:
        rhythmic_counter[rhythmic] += 1
    for ch in text:
        if "\u4e00" <= ch <= "\u9fff":
            char_counter[ch] += 1
    dynasty_counter[dynasty] += 1

    n = nchars
    bucket = ("1–20" if n <= 20 else "21–40" if n <= 40 else "41–60" if n <= 60 else
              "61–80" if n <= 80 else "81–120" if n <= 120 else "121–200" if n <= 200 else "200+")
    length_hist[bucket] += 1

    score = popularity + (2.2 if tags else 0)
    if score > 0:
        item = (score, pid, title, author, lines)
        if len(top_pop) < 400:
            heapq.heappush(top_pop, item)
        elif score > top_pop[0][0]:
            heapq.heapreplace(top_pop, item)
    return pid


def pop_score(item):
    vals = [item.get(k, 0) or 0 for k in ("baidu", "google", "bing", "bing_en", "so360")]
    return round(math.log10(sum(vals) + 10), 2)


def attach_pop(path, n_expected, sample):
    if not os.path.exists(path):
        return [0.0] * n_expected
    data = load(path)
    if len(data) != n_expected:
        return [0.0] * n_expected
    if len(data) and sample and data[0].get("title") and data[0]["title"] != sample:
        log("  ! rank 未对齐", os.path.basename(path))
        return [0.0] * n_expected
    return [pop_score(d) for d in data]


log("读取唐诗三百首 / 宋词三百首 索引")
tang300 = load(os.path.join(BASE, "全唐诗", "唐诗三百首.json"))
tang300_index = {}
for p in tang300:
    tang300_index[(simp(p.get("author")), simp(p.get("title")))] = p

songci300 = load(os.path.join(BASE, "宋词", "宋词三百首.json"))
songci300_index = {}
for p in songci300:
    key = (simp(p.get("author")), simp(p.get("rhythmic")),
           re.sub(r"[，。？！、；：]", "", simp((p.get("paragraphs") or [""])[0]))[:6])
    songci300_index[key] = p

# ---------------- 唐诗 ----------------
log("构建 全唐诗")
tang_files = files_by(os.path.join("全唐诗", "poet.tang.*.json"))
for fi, fp in enumerate(tang_files):
    data = load(fp)
    shard = re.findall(r"[0-9]+", os.path.basename(fp))[-1]
    pops = attach_pop(os.path.join(BASE, "rank", "poet", f"poet.tang.rank.{shard}.json"),
                      len(data), data[0].get("title") if data else None)
    for i, p in enumerate(data):
        key = (simp(p.get("author")), simp(p.get("title")))
        tags = []
        anth = tang300_index.get(key)
        if anth:
            tags = ["唐诗三百首"] + [t for t in anth.get("tags", []) if t != "唐诗三百首"]
        add_poem("tang", "唐", p.get("author"), p.get("title"), p.get("paragraphs") or [],
                 tags=tags, popularity=pops[i])
    if fi % 20 == 0:
        log(f"  {fi + 1}/{len(tang_files)} 累计 {total_poems}")

# ---------------- 宋诗 ----------------
log("构建 全宋诗")
song_files = files_by(os.path.join("全唐诗", "poet.song.*.json"))
for fi, fp in enumerate(song_files):
    data = load(fp)
    shard = re.findall(r"[0-9]+", os.path.basename(fp))[-1]
    pops = attach_pop(os.path.join(BASE, "rank", "poet", f"poet.song.rank.{shard}.json"),
                      len(data), data[0].get("title") if data else None)
    for i, p in enumerate(data):
        add_poem("songshi", "宋", p.get("author"), p.get("title"), p.get("paragraphs") or [],
                 popularity=pops[i])
    if fi % 40 == 0:
        log(f"  {fi + 1}/{len(song_files)} 累计 {total_poems}")

# ---------------- 宋词 ----------------
log("构建 全宋词")
ci_files = files_by(os.path.join("宋词", "ci.song.*.json"))
for fi, fp in enumerate(ci_files):
    data = load(fp)
    shard = re.findall(r"[0-9]+", os.path.basename(fp))[-1]
    pops = attach_pop(os.path.join(BASE, "rank", "ci", f"ci.song.rank.{shard}.json"),
                      len(data), data[0].get("rhythmic") if data else None)
    for i, p in enumerate(data):
        first = re.sub(r"[，。？！、；：]", "", simp((p.get("paragraphs") or [""])[0]))[:6]
        key = (simp(p.get("author")), simp(p.get("rhythmic")), first)
        tags = ["宋词三百首"] if key in songci300_index else []
        add_poem("songci", "宋", p.get("author"), p.get("title") or p.get("rhythmic"),
                 p.get("paragraphs") or [], tags=tags, rhythmic=p.get("rhythmic"),
                 popularity=pops[i])
    if fi % 6 == 0:
        log(f"  {fi + 1}/{len(ci_files)} 累计 {total_poems}")

# ---------------- 元曲 ----------------
log("构建 元曲")
for p in load(os.path.join(BASE, "元曲", "yuanqu.json")):
    add_poem("yuanqu", "元", p.get("author"), p.get("title"), p.get("paragraphs") or [])

# ---------------- 诗经 ----------------
log("构建 诗经")
for p in load(os.path.join(BASE, "诗经", "shijing.json")):
    add_poem("shijing", "先秦", "佚名", p.get("title"), p.get("content") or [],
             tags=[p.get("chapter"), p.get("section")],
             sub=f'{p.get("chapter")}·{p.get("section")}')

# ---------------- 楚辞 ----------------
log("构建 楚辞")
for p in load(os.path.join(BASE, "楚辞", "chuci.json")):
    add_poem("chuci", "先秦", p.get("author"), p.get("title"), p.get("content") or [],
             sub=p.get("section"))

# ---------------- 花间集 ----------------
log("构建 花间集")
hj_files = sorted(set(glob.glob(os.path.join(BASE, "五代诗词", "huajianji", "huajianji-*-juan.json"))))
for fp in hj_files:
    for p in load(fp):
        add_poem("huajian", "五代", p.get("author"), p.get("title"), p.get("paragraphs") or [],
                 rhythmic=p.get("rhythmic"), notes=p.get("notes"))

# ---------------- 南唐二主词 ----------------
log("构建 南唐二主词")
for p in load(os.path.join(BASE, "五代诗词", "nantang", "poetrys.json")):
    add_poem("nantang", "五代", p.get("author"), p.get("title"), p.get("paragraphs") or [],
             rhythmic=p.get("rhythmic"), notes=p.get("notes"))

# ---------------- 千家诗 ----------------
log("构建 千家诗")
qj = load(os.path.join(BASE, "蒙学", "qianjiashi.json"))
for group in qj.get("content", []):
    for p in group.get("content", []):
        raw = simp(p.get("author"))
        m = re.match(r"（(.+?)）(.+)", raw)
        dyn, name = (m.group(1), m.group(2)) if m else ("宋", raw)
        dyn = dyn if dyn in DYNASTY_RANGE else "宋"
        add_poem("qianjia", dyn, name, p.get("chapter"), p.get("paragraphs") or [],
                 sub=group.get("type"))

# ---------------- 水墨唐诗 ----------------
log("构建 水墨唐诗")
for p in load(os.path.join(BASE, "水墨唐诗", "shuimotangshi.json")):
    add_poem("shuimo", "唐", p.get("author"), p.get("title"), p.get("paragraphs") or [],
             prologue=p.get("prologue"))

# ---------------- 纳兰词 ----------------
log("构建 纳兰词")
for p in load(os.path.join(BASE, "纳兰性德", "纳兰性德诗集.json")):
    t = p.get("title")
    rhythmic = t.split("·")[0] if "·" in t else ""
    add_poem("nalan", "清", p.get("author") or "纳兰性德", t, p.get("para") or [], rhythmic=rhythmic)

# ---------------- 曹操 ----------------
log("构建 曹操诗集")
for p in load(os.path.join(BASE, "曹操诗集", "caocao.json")):
    add_poem("caocao", "汉", "曹操", p.get("title"), p.get("paragraphs") or [])

tsv.close()
log(f"语料写入完成：{total_poems} 首，{total_lines} 行，{total_chars} 字")

# ---------------- 诗人档案 ----------------
log("构建诗人档案")
bios = {}
for fp, dyn in [(os.path.join(BASE, "全唐诗", "authors.tang.json"), "唐"),
                (os.path.join(BASE, "全唐诗", "authors.song.json"), "宋")]:
    for a in load(fp):
        key = (simp(a.get("name")), dyn)
        desc = simp(a.get("desc"))
        if desc and len(desc) > len(bios.get(key, "")):
            bios[key] = desc
for a in load(os.path.join(BASE, "宋词", "author.song.json")):
    key = (simp(a.get("name")), "宋")
    desc = simp(a.get("description") or a.get("short_description"))
    if desc and len(desc) > len(bios.get(key, "")):
        bios[key] = desc

authors = []
for (name, dyn), st in author_stats.items():
    authors.append(dict(id="", name=name, dynasty=dyn, poemCount=st["count"], charCount=st["chars"],
                        collections=sorted(st["colls"]), bio=bios.get((name, dyn), "")))
authors.sort(key=lambda x: (-x["poemCount"], x["name"]))
for i, a in enumerate(authors):
    a["id"] = f"a-{i + 1:04d}"
    a["shortBio"] = re.sub(r"\s+", " ", a["bio"])[:120]
with io.open(os.path.join(OUT, "authors.json"), "w", encoding="utf-8") as f:
    json.dump(authors, f, ensure_ascii=False, separators=(",", ":"))
log(f"诗人 {len(authors)} 位")

# ---------------- 统计 ----------------
log("构建统计")
coll_meta = [dict(code=c["code"], name=c["name"], short=c["short"], dynasty=c["dynasty"],
                  era=c["era"], desc=c["desc"], count=coll_counter[c["code"]]) for c in COLLECTIONS]

top_authors = [a for a in authors if a["name"] != "佚名"][:80]
dynasties = []
for d in DYNASTY_ORDER:
    sample = [a["name"] for a in top_authors if a["dynasty"] == d][:4] or \
             [a["name"] for a in authors if a["dynasty"] == d][:3]
    dynasties.append(dict(name=d, count=dynasty_counter.get(d, 0), era=DYNASTY_RANGE.get(d, ""),
                          authors=sum(1 for a in authors if a["dynasty"] == d), sample=sample))

quotes = []
seen_q = set()
for score, pid, title, author, lines in sorted(top_pop, reverse=True):
    for ln in lines:
        core = re.sub(r"[，。？！、；：“”‘’《》（）()·]", "", ln)
        if 6 <= len(core) <= 24 and core not in seen_q:
            seen_q.add(core)
            quotes.append(dict(text=core, author=author, title=title, id=pid))
            break
    if len(quotes) >= 40:
        break

stats = dict(
    totals=dict(poems=total_poems, authors=len(authors), lines=total_lines, chars=total_chars,
                collections=len(COLLECTIONS), dynasties=len(DYNASTY_ORDER),
                rhythms=len(rhythmic_counter), tags=len(tag_counter)),
    collections=coll_meta,
    dynasties=dynasties,
    topAuthors=top_authors[:60],
    topRhythms=[dict(name=k, count=v) for k, v in rhythmic_counter.most_common(60)],
    chars=[dict(c=k, n=v) for k, v in char_counter.most_common(320)],
    imagery=[dict(name=k, count=char_counter.get(k, 0)) for k in
             ["月", "风", "花", "酒", "云", "山", "水", "秋", "春", "夜", "梦", "雪", "江", "天",
              "心", "愁", "诗", "客", "归", "雨", "柳", "梅", "兰", "竹", "松", "鹤", "雁", "舟",
              "剑", "灯", "楼", "烟", "露", "霜", "玉", "金", "红", "白", "青", "草"]],
    lengthDist=[dict(label=k, count=length_hist.get(k, 0)) for k in
                ["1–20", "21–40", "41–60", "61–80", "81–120", "121–200", "200+"]],
    quotes=quotes[:36],
    dailyPool=[pid for score, pid, t, a, l in sorted(top_pop, reverse=True)][:400],
    authorDist=[dict(label=label, count=sum(1 for a in authors
                   if lo <= a["poemCount"] <= hi and a["name"] != "佚名"))
                for label, lo, hi in [("1首", 1, 1), ("2–5", 2, 5), ("6–20", 6, 20),
                                      ("21–100", 21, 100), ("101–500", 101, 500), ("500+", 501, 10**9)]],
)

for c in stats["collections"]:
    c["samples"] = [dict(id=pid, title=t, author=a) for score, pid, t, a, l in
                    sorted([x for x in top_pop if x[1].startswith(c["code"] + "-")], reverse=True)[:3]]

with io.open(os.path.join(OUT, "stats.json"), "w", encoding="utf-8") as f:
    json.dump(stats, f, ensure_ascii=False, separators=(",", ":"))
log("统计完成")

# ---------------- 典籍 ----------------
log("构建典籍")
books = []


def book(bid, title, author, intro, sections, items=None):
    b = dict(id=bid, title=title, author=author, intro=intro,
             sections=[dict(title=t, paragraphs=[simp(x) for x in ps if clean(x)]) for t, ps in sections])
    if items is not None:
        b["items"] = items
    books.append(b)


for c in load(os.path.join(BASE, "论语", "lunyu.json")):
    _ = c.get("chapter")
ly = load(os.path.join(BASE, "论语", "lunyu.json"))
book("lunyu", "论语", "孔子及其弟子",
     "《论语》是孔子及其弟子的言行辑录，二十篇，四百九十二章。中国人的处世、为学与为政，几乎都可以在这里找到最初的句子。",
     [(c["chapter"], c["paragraphs"]) for c in ly])
# 修正上面粗体引号
books[-1]["intro"] = "《论语》是孔子及其弟子的言行辑录，二十篇，四百九十二章。中国人的处世、为学与为政，几乎都可以在这里找到最初的句子。"

for bid, fname, title, author, intro in [
    ("daxue", "daxue.json", "大学", "曾子",
     "《大学》原为《礼记》中的一篇，朱熹列为「四书」之首。以「明明德、亲民、止于至善」为纲，讲修身与治国的次第。"),
    ("zhongyong", "zhongyong.json", "中庸", "子思",
     "《中庸》传为子思所作，讲「中」与「和」，把儒家的人生态度提升为一种宇宙秩序。"),
]:
    d = load(os.path.join(BASE, "四书五经", fname))
    book(bid, title, author, intro, [(d.get("chapter", title), d.get("paragraphs", []))])

book("mengzi", "孟子", "孟子及其弟子",
     "《孟子》七篇十四卷，以雄辩与寓言说仁义，气势磅礴。「民为贵，社稷次之，君为轻」的民本思想即出于此。",
     [(c["chapter"], c["paragraphs"]) for c in load(os.path.join(BASE, "四书五经", "mengzi.json"))])


def from_mengxue(fname, bid, title, author, intro):
    d = load(os.path.join(BASE, "蒙学", fname))
    secs = []
    if "content" in d:
        for blk in d["content"]:
            if isinstance(blk, dict) and "content" in blk:
                for ch in blk["content"]:
                    if isinstance(ch, dict):
                        secs.append((f'{blk.get("title", "")}·{ch.get("chapter", "")}', ch.get("paragraphs", [])))
            elif isinstance(blk, dict):
                secs.append((blk.get("chapter", blk.get("title", "")), blk.get("paragraphs", [])))
    elif "paragraphs" in d:
        secs.append((title, d["paragraphs"]))
    book(bid, title, d.get("author", author), intro, secs)


from_mengxue("sanzijing-new.json", "sanzijing", "三字经", "王应麟",
             "「人之初，性本善。」三字一句的蒙学经典，把历史、伦理与常识压缩成朗朗上口的韵语。")
from_mengxue("dizigui.json", "dizigui", "弟子规", "李毓秀",
             "清初李毓秀所作，以《论语》「弟子入则孝」一章为纲，列述子弟在家、出外、待人、求学的规范。")
from_mengxue("qianziwen.json", "qianziwen", "千字文", "周兴嗣",
             "梁周兴嗣一夜编成，千字不重，四言协韵。自隋唐至明清，它是最流行的识字课本。")
from_mengxue("baijiaxing.json", "baijiaxing", "百家姓", "佚名",
             "「赵钱孙李，周吴郑王。」一部关于姓氏的韵语，也是旧时孩童的第一个课本。")
from_mengxue("shenglvqimeng.json", "shenglvqimeng", "声律启蒙", "车万育",
             "按韵分编的对仗训练，「云对雨，雪对风，晚照对晴空」，汉语的音韵之美在此启蒙。")
from_mengxue("youxueqionglin.json", "youxueqionglin", "幼学琼林", "程登吉",
             "明人程登吉编纂的百科式蒙书，天文地理、人情世故，皆以骈语出之。")
from_mengxue("zengguangxianwen.json", "zengguangxianwen", "增广贤文", "佚名",
             "汇集民间谚语与格言的蒙书，「知己知彼，将心比心」，句句是世故，也句句是慈悲。")
from_mengxue("zhuzijiaxun.json", "zhuzijiaxun", "朱子家训", "朱柏庐",
             "清初朱柏庐所作家训，五百余字，「黎明即起，洒扫庭除」，是中国最著名的家训之一。")

gz = load(os.path.join(BASE, "蒙学", "guwenguanzhi.json"))
book("guwenguanzhi", "古文观止", "吴楚材 · 吴调侯",
     "清康熙年间编选的古文读本，上起先秦，下迄明末，收文二百二十二篇，是流传最广的古文选本。",
     [(f'{vol.get("title", "")}·{ch.get("chapter", "")}', ch.get("paragraphs", []))
      for vol in gz.get("content", []) for ch in vol.get("content", [])])

ym = load(os.path.join(BASE, "幽梦影", "youmengying.json"))
books.append(dict(id="youmengying", title="幽梦影", author="张潮", sections=[], items=[],
                  intro="清人张潮的随笔小品，二百一十九则。谈山水、花月、读书与友朋，句句清丽，附有友人评语。"))
books[-1]["items"] = [dict(text=simp(x["content"]), comments=[simp(c) for c in x.get("comment", [])]) for x in ym]

with io.open(os.path.join(OUT, "classics.json"), "w", encoding="utf-8") as f:
    json.dump(dict(books=books), f, ensure_ascii=False, separators=(",", ":"))

# ---------------- 简繁映射 ----------------
log("导出简繁映射")
import opencc as _ocpkg
pkg_dir = os.path.dirname(_ocpkg.__file__)
char_map = {}
for line in io.open(os.path.join(pkg_dir, "dictionary", "STCharacters.txt"), encoding="utf-8"):
    parts = line.strip().split("\t")
    if len(parts) >= 2:
        char_map[parts[0]] = parts[1].split(" ")[0]
phrase_map = {}
p2 = os.path.join(pkg_dir, "dictionary", "STPhrases.txt")
if os.path.exists(p2):
    for line in io.open(p2, encoding="utf-8"):
        parts = line.strip().split("\t")
        if len(parts) >= 2 and len(parts[0]) <= 8:
            phrase_map[parts[0]] = parts[1].split(" ")[0]
corpus_chars = set(char_counter.keys())
filtered = {k: v for k, v in phrase_map.items() if any(c in corpus_chars for c in k) and v != k}
with io.open(os.path.join(OUT, "s2t.json"), "w", encoding="utf-8") as f:
    json.dump(dict(chars=char_map, phrases=filtered), f, ensure_ascii=False, separators=(",", ":"))

log(f"完成。{os.listdir(OUT)}")
