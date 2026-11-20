# 墨澜 · MOLAN — 中国古典诗词数字档案

> 三千载诗心，一屏可揽。

墨澜是一个基于开源项目 [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) 数据集构建的中国古典诗词数字档案馆。它把散落在 JSON 文件中的诗、词、曲、经、典籍，整理成可检索、可漫游、可做数据观察的网站。

**在线规模**：345,386 首作品 · 13,733 位诗人 · 1,580,038 行 · 21,834,450 字 · 1,476 个词牌 · 12 部总集 · 14 部典籍。

---

## 一、网站有什么

| 板块                                    | 内容                                                                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **首页**                          | 星尘与罗盘构成的 hero、竖排「每日诗笺」轮播、名句跑马灯、数据带、诗歌长河时间轴、十二总集卡、今日诗笺、词牌星图、意象字海、飞花令、诗人榜 |
| **诗库** `/library`             | 按总集 / 朝代 / 标签 / 诗人筛选，支持全文关键词、篇幅区间与五种排序，无限滚动加载                                                         |
| **诗页** `/poem/:id`            | 竖排 / 横排一键切换、简繁切换、收藏与复制、作者档案、注释与赏析、同作者 / 同词牌推荐、前后篇                                              |
| **诗人** `/poets` `/poet/:id` | 按朝代与姓名检索、产量排行、诗人详情（生平、常用字、作品栅格）                                                                            |
| **图谱** `/atlas`               | 朝代分布、词牌极坐标、意象星图、高频字海、篇幅直方图、词牌前二十、诗人产量分布、诗人星图（产量长尾）                                      |
| **全文检索** `/search`          | 跨全部语料检索，结果按名篇与热度加权排序；`⌘K` / `Ctrl+K` 可唤起检索浮层                                                             |
| **典籍** `/classics`            | 论语、孟子、大学、中庸、诗经以外的蒙学与古文选本，带章节目录的阅读器                                                                      |
| **收藏** `/favorites`           | 保存在本机的收藏夹，可回到任意一首收藏的诗或移除                                                                                          |
| **关于** `/about`               | 数据来源、处理流程、统计口径与技术栈                                                                                                      |

### 设计

- 暗色「墨金」体系：墨黑 `#05060a`、金 `#d8b36a`、玉 `#74c8b6`、朱砂 `#c4523e`。
- 中文标题使用 **Noto Serif SC** 子集（只打包语料实际出现的汉字），拉丁字使用 Space Grotesk 与 IBM Plex Mono。
- 全局噪点、径向光晕、卡片鼠标跟随聚光、滚动揭示、金色发丝线、印章与竖排文本。
- 无 UI 组件库、无图表库，全部图表为手写 SVG / Canvas。

---

## 二、技术栈

| 层   | 选型                                                     |
| ---- | -------------------------------------------------------- |
| 前端 | React 18 · TypeScript 5 · Vite 6 · react-router-dom 6 |
| 样式 | 原生 CSS（约 39 KB，gzip 8.6 KB），自定义设计令牌        |
| 服务 | Node.js 内置 `http`，**零第三方依赖**            |
| 数据 | Python 3 预处理；语料以紧凑 TSV 常驻内存                 |
| 字体 | fonttools `pyftsubset` 子集化，woff2 共约 4.7 MB       |

### 目录

```
中国诗歌/
├─ server/
│  ├─ index.js              # 零依赖 HTTP 服务：API + 静态资源 + SPA 回退
│  └─ data/
│     ├─ poems-01.tsv … 04  # 345,386 首，按记录边界切成 4 片，每片 21.83 MiB
│     ├─ authors.json       # 13,733 位诗人档案
│     ├─ classics.json      # 14 部典籍
│     ├─ stats.json         # 统计、名句、每日诗笺池
│     └─ s2t.json           # 简→繁映射（按需加载）
├─ cloudflare/
│  ├─ worker.js             # Workers API：D1 + FTS5
│  ├─ schema.sql            # D1 表结构与索引
│  ├─ wrangler.toml         # ASSETS / DB binding
│  └─ CLOUDFLARE.md         # 部署步骤
├─ tools/
│  ├─ build_corpus.py       # 原始 JSON → poems.tsv / authors / stats
│  ├─ post_stats.py         # 人工校订名句 + 每日诗笺池
│  ├─ patch_stats.py        # 补齐标签与词牌清单
│  ├─ split_poems.py        # 按记录边界切分 4 个 <25 MiB 分片
│  ├─ build_fonts.py        # 字形子集与拉丁字体
│  ├─ build_cloudflare_seed.py # 生成 D1 种子 SQL / 本地 SQLite
│  └─ prepare_cloudflare.js # 复制运行期 JSON 到 web/public/data
├─ web/
│  ├─ src/                  # React 源码（pages / components / styles.css）
│  ├─ public/fonts/         # woff2 子集字体
│  └─ dist/                 # 构建产物（server 直接托管）
├─ 启动网站.bat              # Windows 一键启动
├─ package.json
└─ README.md
```

---

## 三、运行

### 前置

- Node.js 18+（本项目在 Node 22 上开发）
- 首次运行如需重新安装前端依赖：`cd web && npm install`

### 一键启动（Windows）

双击根目录的 **`启动网站.bat`**，或在终端执行：

```powershell
npm start
```

然后访问 **[http://127.0.0.1:5177](http://127.0.0.1:5177)**。

服务启动时会依次读取 4 个分片（合计约 87 MB），通常 3–4 秒完成；就绪前请稍候。

### 开发模式

```powershell
# 终端 1：数据服务（5177）
npm start

# 终端 2：Vite 开发服务器（5178，/api 代理到 5177）
cd web
npm run dev
```

开发地址：[http://127.0.0.1:5178](http://127.0.0.1:5178)

### 重新构建前端

```powershell
cd web
npm run build
```

构建后刷新页面即可；`server` 会自动托管最新的 `web/dist`。

### 重新生成数据（可选）

需要 Python 3 与 `opencc-python-reimplemented`，并把原始仓库放在 `D:\Source\Repos\chinese-poetry`：

```powershell
pip install opencc-python-reimplemented
npm run data                 # 构建 TSV/JSON，并自动切成 4 个 21.83 MiB 分片
python tools/build_fonts.py  # 需要 fonttools 与 brotli；按需重建字形子集
python tools/build_cloudflare_seed.py --sqlite cloudflare/molan.sqlite
```

---

## 四、数据来源与处理

原始数据来自 **chinese-poetry**（MIT License），包含全唐诗、全宋诗、全宋词、元曲、诗经、楚辞、花间集、南唐二主词、千家诗、水墨唐诗、纳兰词、曹操诗集等 12 部总集，以及论语、孟子、大学、中庸等 14 部典籍。

处理要点：

1. **统一简体**：原库中唐诗多为繁体、宋词多为简体，使用 OpenCC `t2s` 统一转换；站点再通过 `/api/s2t` 按需还原繁体，供简繁切换。
2. **合并诗人档案**：合并 `authors.tang`（3,675）、`authors.song`（8,934）与词人档案（1,563），同一诗人取最长传记。
3. **名篇标签**：`唐诗三百首`、`宋词三百首` 不单列集合，而以标签并入对应作品，保留「三百首」筛选与加权。
4. **热度**：读取 `rank/poet`、`rank/ci` 中的百度 / Google / Bing 检索量，按 `log10(baidu+google+bing+bing_en+so360+10)` 归一为热度，用于「热门」排序与名篇加权。
5. **去重取舍**：`御定全唐詩`（43,103 首，繁体且与全唐诗大量重复）不纳入主站；`strains`（格律）、`error` 目录弃用。
6. **人工校订**：48 条千古名句由人工挑选校对，替换早期按热度自动抽取的劣质摘句。

统计口径：诗人总数只计入确有作品的作者；同一诗人跨多个总集时分别归属朝代，不做合并。

---

## 五、API

所有接口均为 `GET`，返回 JSON；服务默认监听 `127.0.0.1:5177`。

| 路径                                      | 说明                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/api/stats`（别名 `/api/meta`）      | 总量、总集、朝代、诗人榜、词牌、字频、意象、篇幅分布、名句、每日池                                        |
| `/api/poems`                            | 分页列表；支持 `coll` `dyn` `tag` `author` `q` `sort` `minLen` `maxLen` `page` `size` |
| `/api/poem/:id`                         | 作品详情：正文、注释、赏析、作者档案、同作者 / 同词牌、前后篇                                             |
| `/api/poem/random`                      | 随机一首（可按 `coll` 限定）                                                                            |
| `/api/poets`                            | 诗人列表：`dyn` `q` `sort` `page` `size`                                                        |
| `/api/poet/:id`                         | 诗人详情：传记、常用字、作品栅格、总作品数                                                                |
| `/api/search`                           | 全文检索，返回命中总数与分页结果                                                                          |
| `/api/lines`                            | 飞花令：单字 / 双字诗句接龙                                                                               |
| `/api/daily`                            | 今日诗笺，可按 `date=YYYY-MM-DD` 复现                                                                   |
| `/api/classics` / `/api/classics/:id` | 典籍目录与全文                                                                                            |
| `/api/s2t`                              | 简→繁映射（前端懒加载）                                                                                  |

---

## 六、Cloudflare 部署

仓库同时提供 **Cloudflare Workers Static Assets + D1** 的部署形态：

- 前端 `web/dist` 由 `ASSETS` binding 托管；`/api/*` 由 `cloudflare/worker.js` 接管。
- D1 保存 34.5 万首诗与 FTS5 索引，`DB` binding；中文检索用逐字空格化 + phrase 匹配。
- 语料拆成 4 个 `<25 MiB` 分片，满足 Cloudflare 单文件限制。

完整步骤见 [`cloudflare/CLOUDFLARE.md`](cloudflare/CLOUDFLARE.md)。本地可用 `node tools/test_cloudflare_worker.mjs` 以 SQLite 模拟 D1，跑全部路由。

---

## 七、若干实现细节

- **TSV 而非数据库**：本地 Node 版把 345,386 首常驻内存，避免外部依赖；列表查询约 100–150 ms，全文检索约 120 ms。Cloudflare 版改用 D1，避免 Worker 内存与 CPU 限制。
- **生僻字**：`全唐诗` 原始文本里有 357 种 `{上休下鳥}` 式结构字，其中 13 种能从 `表面结构字.json` 对应到 Unicode 字形，构建时已还原；其余 344 种源数据本身没有编码，保留结构式显示，不会变成豆腐块。
- **段落切分**：TSV 正文用 `\x02` 表示换行，读取时还原；早期曾因直接按 `\n` 切分导致整首诗变成一行。
- **检索排序**：`标题 +70 / 作者 +55 / 词牌 +45 / 正文 +30 / 标签 +10`，再叠加 `min(热度,10)*14` 与三百首 `+120`，使「明月」首位为苏轼《水调歌头》。
- **竖排**：诗页与首页诗笺均按标点切句、逐句成列，避免在字中间断行；超长诗（>24 行）自动隐藏竖排入口。
- **性能**：静态资源 gzip + ETag；字体按语料子集化；首页星尘使用 Canvas，其余图表为 SVG。

---

## 八、许可

- 代码：MIT
- 原始诗词数据：[chinese-poetry](https://github.com/chinese-poetry/chinese-poetry)，MIT License
- 字体：Noto Serif SC（SIL Open Font License）、Space Grotesk（SIL OFL）、IBM Plex Mono（SIL OFL）

站内文字与排版仅用于数据展示与学习研究；如需商用，请遵循原数据集与字体的许可条款。
