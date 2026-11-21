# 墨澜 · MOLAN — 中国古典诗词数字档案

> 三千载诗心，一屏可揽。

墨澜基于开源项目 [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) 构建，把散落在 JSON 中的诗、词、曲、经、典籍整理成可检索、可漫游、可做数据观察的网站。

**规模**：345,386 首作品 · 13,733 位诗人 · 1,580,038 行 · 21,834,450 字 · 1,476 个词牌 · 12 部总集 · 14 部典籍。

## 在线地址

- GitHub Pages：`https://gufengaoyue.github.io/tiongkok-poetry/`
- EdgeOne：`https://tiongkok-poetry.cn`

## 网站功能

| 板块 | 内容 |
| --- | --- |
| 首页 | 星尘与罗盘 hero、竖排每日诗笺、名句跑马灯、数据带、诗歌长河、十二总集、词牌星图、意象字海、飞花令、诗人榜 |
| 诗库 `/library` | 按总集 / 朝代 / 标签 / 诗人筛选，全文关键词、篇幅区间、五种排序、无限滚动 |
| 诗页 `/poem/:id` | 竖排 / 横排切换、简繁切换、收藏与复制、作者档案、注释赏析、同作者 / 同词牌推荐、前后篇 |
| 诗人 `/poets` `/poet/:id` | 按朝代与姓名检索、产量排行、生平、常用字、作品栅格 |
| 图谱 `/atlas` | 朝代分布、词牌极坐标、意象星图、高频字海、篇幅直方图、诗人产量长尾 |
| 全文检索 `/search` | 跨全部语料检索，名篇与热度加权；`⌘K` / `Ctrl+K` 唤起检索浮层 |
| 典籍 `/classics` | 论语、孟子、大学、中庸等 14 部典籍的章节目录阅读器 |
| 收藏 `/favorites` | 本机收藏夹 |
| 关于 `/about` | 数据来源、处理流程、统计口径与技术栈 |

设计上提供墨金（默认）与米白 / 宣纸两套主题；桌面端与移动端均可切换并记忆。中文标题使用 Noto Serif SC 子集，图表全部为手写 SVG / Canvas，无 UI 组件库、无图表库。

## 目录

```text
中国诗歌/
├─ server/
│  ├─ index.js                  # 本地零依赖 HTTP 服务：API + 静态资源 + SPA 回退
│  └─ data/                     # 语料切片、作者、典籍、统计、简繁映射
├─ tools/
│  ├─ build_corpus.py           # 原始 JSON → TSV / authors / stats
│  ├─ build_static_site.py      # 静态分片、诗人、飞花令
│  ├─ build_range_index.py      # token-index.bin / token-offsets.json
│  └─ build_fonts.py            # 字体子集
├─ web/
│  ├─ src/                      # React 源码
│  ├─ public/                   # 字体、robots、小型运行期数据
│  └─ package.json
├─ package.json
└─ README.md
```

## 本地运行

前置：Node.js 18+；重建数据时需要 Python 3。

```powershell
npm start
```

访问 http://127.0.0.1:5177。

开发模式：

```powershell
# 终端 1：本地 API + 静态资源（5177）
npm start

# 终端 2：Vite（5178，/api 代理到 5177）
cd web
npm run dev
```

## 数据来源与处理

原始数据来自 **chinese-poetry**（MIT License），包含全唐诗、全宋诗、全宋词、元曲、诗经、楚辞、花间集、南唐二主词、千家诗、水墨唐诗、纳兰词、曹操诗集等 12 部总集，以及论语、孟子、大学、中庸等 14 部典籍。

处理要点：

1. **统一简体**：使用 OpenCC `t2s` 统一，站点再通过 `s2t.json` 按需还原繁体。
2. **合并诗人档案**：合并唐诗、宋诗与词人档案，同一诗人取最长传记。
3. **名篇标签**：`唐诗三百首`、`宋词三百首` 不单列集合，以标签并入对应作品。
4. **热度**：读取 `rank/poet`、`rank/ci` 检索量并归一。
5. **去重取舍**：`御定全唐詩` 不纳入主站；`strains`、`error` 目录弃用。
6. **人工校订**：48 条千古名句由人工挑选校对。

统计口径：诗人总数只计入确有作品的作者；同一诗人跨多个总集时分别归属朝代，不做合并。

## License

代码 MIT。语料来自 chinese-poetry，遵循其原始 MIT License。
