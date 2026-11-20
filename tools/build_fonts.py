# -*- coding: utf-8 -*-
"""生成站点字形子集字体（只含语料实际出现的汉字），以及拉丁字体。"""
import io, json, os, re, subprocess, urllib.request

ROOT = r"D:\Source\Repos\中国诗歌"
DATA = os.path.join(ROOT, "server", "data")
SRC = os.path.join(ROOT, "tools", "fonts")
DEST = os.path.join(ROOT, "web", "public", "fonts")
os.makedirs(DEST, exist_ok=True)

# 1. 收集语料字符
chars = set()
poem_files = sorted(f for f in os.listdir(DATA) if f.startswith("poems-") and f.endswith(".tsv"))
for fn in poem_files:
    text = io.open(os.path.join(DATA, fn), encoding="utf-8").read()
    chars.update(text)
if not poem_files and os.path.exists(os.path.join(DATA, "poems.tsv")):
    chars.update(io.open(os.path.join(DATA, "poems.tsv"), encoding="utf-8").read())
for fn in ["authors.json", "classics.json", "stats.json"]:
    p = os.path.join(DATA, fn)
    if os.path.exists(p):
        text = io.open(p, encoding="utf-8").read()
        chars.update(text)

# UI 常用字符与应用自造文案
UI_TEXT = """
墨澜诗库诗人图谱典籍检索首页全部朝代词牌题材简体繁体字数行数热门最新随机漫游每日一诗
诗歌长河数据总览词牌星河意象之海高频字长度分布产量诗人星图阅读注释赏析译文上一篇下一篇
返回加载搜索输入关键词结果未找到暂无数据来源关于技术支持收录首作品位共篇阅读全文展开收起
朝代先秦汉唐五代宋元清作者简介生平代表作品名句选集收藏复制分享相似同作者同词牌上一页下一页
墨色印章宣纸卷轴序跋正文目录卷一其二无题佚名筛选排序视图网格列表加载中重新尝试连接失败
中国古典诗词数字档案字数据统计共有种体裁目前展示的是全部库中的已选条件清除确认
诗中有画画中有诗山水田园边塞送别思乡怀古咏物闺怨豪放婉约格律绝句律诗古风乐府
输入一个字或一句话开始探索例如明月春风江南把酒问青天请按搜索键进行检索
"""

chars.update(UI_TEXT)
chars.update("\u3000\u3001\u3002\uff0c\uff1b\uff1a\uff1f\uff01\uff08\uff09\u300a\u300b\u300c\u300d\u300e\u300f\u2014\u2026\u00b7\uff5e")

han = {c for c in chars if "\u4e00" <= c <= "\u9fff"}
other = {c for c in chars if not ("\u4e00" <= c <= "\u9fff") and ord(c) > 127}
print("汉字字形数：", len(han), " 其他非 ASCII：", len(other))

text_file = os.path.join(SRC, "glyphs.txt")
allchars = sorted(han | other | {chr(i) for i in range(32, 127)})
io.open(text_file, "w", encoding="utf-8").write("".join(allchars))

# 2. 子集化 Noto Serif SC
for weight in ["400", "600"]:
    src = os.path.join(SRC, f"nssc{weight}.ttf")
    dst = os.path.join(DEST, f"serif-sc-{weight}.woff2")
    cmd = [
        "pyftsubset", src, f"--text-file={text_file}", "--flavor=woff2",
        f"--output-file={dst}", "--layout-features=*", "--no-hinting",
        "--desubroutinize", "--drop-tables+=DSIG", "--name-IDs=*",
    ]
    subprocess.run(cmd, check=True)
    print(f"  serif {weight}: {os.path.getsize(dst)/1024/1024:.2f} MB")

# 3. 拉丁字体（Space Grotesk / IBM Plex Mono）
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=60).read()


def grab_latin(family, weights, out_name):
    css_url = f"https://fonts.googleapis.com/css2?family={family.replace(' ', '+')}:wght@{weights}&display=swap"
    css = fetch(css_url).decode("utf-8")
    blocks = re.findall(r"@font-face\s*\{[^}]*\}", css)
    best = None
    for b in blocks:
        if "unicode-range" in b and "U+0000-00FF" in b or "latin" in b:
            m = re.search(r"url\((https://[^)]+\.woff2)\)", b)
            if m:
                best = m.group(1)
                break
    if not best:
        m = re.search(r"url\((https://[^)]+\.woff2)\)", css)
        best = m.group(1) if m else None
    if best:
        data = fetch(best)
        p = os.path.join(DEST, out_name)
        io.open(p, "wb").write(data)
        print("  ", out_name, f"{len(data)/1024:.0f} KB")
    else:
        print("  ! 未能解析", family)


grab_latin("Space Grotesk", "400;500;600;700", "grotesk-latin.woff2")
grab_latin("IBM Plex Mono", "400;500", "plexmono-latin.woff2")

print("完成：", os.listdir(DEST))
