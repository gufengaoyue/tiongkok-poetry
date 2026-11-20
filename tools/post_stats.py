# -*- coding: utf-8 -*-
"""后处理：用人工校订的千古名句替换统计中的「热门句」，并生成每日一诗池。"""
import io, json, re, os

OUT = r"D:\Source\Repos\中国诗歌\server\data"

QUOTES = [
    ("床前明月光，疑是地上霜。", "李白", "静夜思"),
    ("飞流直下三千尺，疑是银河落九天。", "李白", "望庐山瀑布"),
    ("君不见黄河之水天上来，奔流到海不复回。", "李白", "将进酒"),
    ("两岸猿声啼不住，轻舟已过万重山。", "李白", "早发白帝城"),
    ("举杯邀明月，对影成三人。", "李白", "月下独酌"),
    ("无边落木萧萧下，不尽长江滚滚来。", "杜甫", "登高"),
    ("烽火连三月，家书抵万金。", "杜甫", "春望"),
    ("会当凌绝顶，一览众山小。", "杜甫", "望岳"),
    ("随风潜入夜，润物细无声。", "杜甫", "春夜喜雨"),
    ("红豆生南国，春来发几枝。", "王维", "相思"),
    ("空山新雨后，天气晚来秋。", "王维", "山居秋暝"),
    ("欲穷千里目，更上一层楼。", "王之涣", "登鹳雀楼"),
    ("海内存知己，天涯若比邻。", "王勃", "送杜少府之任蜀州"),
    ("春眠不觉晓，处处闻啼鸟。", "孟浩然", "春晓"),
    ("海上生明月，天涯共此时。", "张九龄", "望月怀远"),
    ("此情可待成追忆，只是当时已惘然。", "李商隐", "锦瑟"),
    ("春蚕到死丝方尽，蜡炬成灰泪始干。", "李商隐", "无题"),
    ("停车坐爱枫林晚，霜叶红于二月花。", "杜牧", "山行"),
    ("商女不知亡国恨，隔江犹唱后庭花。", "杜牧", "泊秦淮"),
    ("旧时王谢堂前燕，飞入寻常百姓家。", "刘禹锡", "乌衣巷"),
    ("野火烧不尽，春风吹又生。", "白居易", "赋得古原草送别"),
    ("天长地久有时尽，此恨绵绵无绝期。", "白居易", "长恨歌"),
    ("同是天涯沦落人，相逢何必曾相识。", "白居易", "琵琶行"),
    ("秦时明月汉时关，万里长征人未还。", "王昌龄", "出塞"),
    ("葡萄美酒夜光杯，欲饮琵琶马上催。", "王翰", "凉州词"),
    ("忽如一夜春风来，千树万树梨花开。", "岑参", "白雪歌送武判官归京"),
    ("月落乌啼霜满天，江枫渔火对愁眠。", "张继", "枫桥夜泊"),
    ("日暮乡关何处是？烟波江上使人愁。", "崔颢", "黄鹤楼"),
    ("黑云压城城欲摧，甲光向日金鳞开。", "李贺", "雁门太守行"),
    ("前不见古人，后不见来者。", "陈子昂", "登幽州台歌"),
    ("海日生残夜，江春入旧年。", "王湾", "次北固山下"),
    ("山重水复疑无路，柳暗花明又一村。", "陆游", "游山西村"),
    ("春风又绿江南岸，明月何时照我还？", "王安石", "泊船瓜洲"),
    ("大江东去，浪淘尽，千古风流人物。", "苏轼", "念奴娇"),
    ("但愿人长久，千里共婵娟。", "苏轼", "水调歌头"),
    ("十年生死两茫茫，不思量，自难忘。", "苏轼", "江城子"),
    ("众里寻他千百度，蓦然回首，那人却在，灯火阑珊处。", "辛弃疾", "青玉案"),
    ("醉里挑灯看剑，梦回吹角连营。", "辛弃疾", "破阵子"),
    ("寻寻觅觅，冷冷清清，凄凄惨惨戚戚。", "李清照", "声声慢"),
    ("莫道不销魂，帘卷西风，人比黄花瘦。", "李清照", "醉花阴"),
    ("今宵酒醒何处？杨柳岸，晓风残月。", "柳永", "雨霖铃"),
    ("两情若是久长时，又岂在朝朝暮暮。", "秦观", "鹊桥仙"),
    ("无可奈何花落去，似曾相识燕归来。", "晏殊", "浣溪沙"),
    ("问君能有几多愁？恰似一江春水向东流。", "李煜", "虞美人"),
    ("人生若只如初见，何事秋风悲画扇。", "纳兰性德", "木兰花令"),
    ("对酒当歌，人生几何！", "曹操", "短歌行"),
    ("关关雎鸠，在河之洲。窈窕淑女，君子好逑。", "佚名", "关雎"),
    ("路漫漫其修远兮，吾将上下而求索。", "屈原", "离骚"),
]


def norm(t):
    return re.sub(r"[^\u4e00-\u9fff]", "", t or "")


stats = json.load(io.open(os.path.join(OUT, "stats.json"), encoding="utf-8"))
by_key = {}
anth_ids = []
for line in io.open(os.path.join(OUT, "poems.tsv"), encoding="utf-8"):
    f = line.rstrip("\n").split("\x1f")
    if len(f) < 12:
        continue
    pid, coll, dyn, author, title, content, tags = f[0], f[1], f[2], f[3], f[4], f[5], f[6]
    by_key.setdefault((author, norm(title)), []).append((pid, content))
    if "唐诗三百首" in tags or "宋词三百首" in tags:
        anth_ids.append(pid)

quotes = []
for text, author, title in QUOTES:
    pid = None
    cands = by_key.get((author, norm(title)), [])
    if not cands:
        # 标题前缀匹配，如「无题」「念奴娇」
        for (a, t), lst in by_key.items():
            if a == author and norm(title) and norm(title) in t:
                cands = lst
                break
    if cands:
        for p, c in cands:
            if norm(text)[:10] in norm(c):
                pid = p
                break
        if not pid:
            pid = cands[0][0]
    quotes.append(dict(text=text, author=author, title=title, id=pid or ""))

stats["quotes"] = quotes
stats["dailyPool"] = list(dict.fromkeys([q["id"] for q in quotes if q["id"]] + anth_ids))[:520]
json.dump(stats, io.open(os.path.join(OUT, "stats.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
print("quotes", len(quotes), "matched", sum(1 for q in quotes if q["id"]), "pool", len(stats["dailyPool"]))
for q in quotes:
    if not q["id"]:
        print("  MISS", q["author"], q["title"], q["text"])
