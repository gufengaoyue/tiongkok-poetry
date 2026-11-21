# 墨澜 · MOLAN — 中国古典诗词数字档案

> 三千载诗心，一屏可揽。

墨澜是一个基于开源项目 [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) 构建的中国古典诗词数字档案馆。它把散落在 JSON 中的诗、词、曲、经、典籍，整理成可检索、可漫游、可做数据观察的网站。

**在线规模**：345,386 首作品 · 13,733 位诗人 · 1,580,038 行 · 21,834,450 字 · 1,476 个词牌 · 12 部总集 · 14 部典籍。

## 在线地址

| 通道 | 地址 | 说明 |
| --- | --- | --- |
| **GitHub Pages（主站）** | **https://gufengaoyue.github.io/chinese-poetry/** | 国内可直连，纯静态，免费 |
| EdgeOne Pages（海外节点备用） | https://tiongkok-poetry.cn（归属验证中） | 项目 `tiongkok-poetry-overseas` 已自动部署；GitHub Actions 自动更新，待 TXT 归属验证与 CNAME 生效 |
| Cloudflare Workers（备用） | https://molan-verse-archive.gufengaoyue.workers.dev | 海外可用；当前网络下 `workers.dev` 被 DNS 污染，国内无法直连 |

GitHub Pages 是当前实际可用的主站。EdgeOne 是独立的第二条发布通道，不会替换或影响 GitHub Pages；Cloudflare 版本保留作为海外镜像。

---

## 一、网站有什么

| 板块 | 内容 |
| --- | --- |
| **首页** | 星尘与罗盘 hero、竖排每日诗笺、名句跑马灯、数据带、诗歌长河、十二总集、词牌星图、意象字海、飞花令、诗人榜 |
| **诗库** `/library` | 按总集 / 朝代 / 标签 / 诗人筛选，支持全文关键词、篇幅区间与五种排序，无限滚动 |
| **诗页** `/poem/:id` | 竖排 / 横排切换、简繁切换、收藏与复制、作者档案、注释赏析、同作者 / 同词牌推荐、前后篇 |
| **诗人** `/poets` `/poet/:id` | 按朝代与姓名检索、产量排行、生平、常用字、作品栅格 |
| **图谱** `/atlas` | 朝代分布、词牌极坐标、意象星图、高频字海、篇幅直方图、诗人产量长尾 |
| **全文检索** `/search` | 跨全部语料检索，名篇与热度加权；`⌘K` / `Ctrl+K` 唤起检索浮层 |
| **典籍** `/classics` | 论语、孟子、大学、中庸等 14 部典籍的章节目录阅读器 |
| **收藏** `/favorites` | 本机收藏夹 |
| **关于** `/about` | 数据来源、处理流程、统计口径与技术栈 |

### 设计

- 两套页面风格：**墨金**（默认，墨黑 `#05060a`、金 `#d8b36a`、玉 `#74c8b6`）与 **米白 / 宣纸**（米白 `#f6efe1`、深金 `#9a6c24`、墨色正文）。
- 桌面端在导航右侧切换「墨金 / 米白」；移动端在导航抽屉底部的「页面风格」切换。选择保存在本机浏览器，刷新后保持。
- 中文标题使用 **Noto Serif SC** 子集（只打包语料实际出现的汉字），拉丁字使用 Space Grotesk 与 IBM Plex Mono。
- 全局噪点、径向光晕、卡片聚光、滚动揭示、金色发丝线、印章与竖排文本。
- 无 UI 组件库、无图表库；图表全部为手写 SVG / Canvas，图表颜色随主题切换。

---

## 二、免费架构

站点不依赖 Workers Paid、不依赖 D1 全库，全部运行在免费额度内：

```text
浏览器
  ├─ 静态页面 / 字体 / 样式        GitHub Pages
  ├─ 诗库正文分片                  /data/poems/0001..0346.json
  ├─ 浏览索引（8 段）              /data/poem-index-000..007.json
  ├─ 诗人 / 每日 / 随机 / 飞花令   /data/*.json
  └─ 全文检索
       ├─ 有 /api 时：Cloudflare Worker + D1 小索引
       └─ 无 /api 时：HTTP Range 读取 /data/token-index.bin
```

**关键点**：

1. 诗库正文按 1,000 首一片切成 346 个 JSON，单文件约 300 KB，页面按需读取。
2. 浏览索引切成 8 段，每段约 43,174 首，低于 GitHub Pages / Cloudflare 的单文件限制。
3. 全文检索索引只有 **30.9 MiB**，包含 12,682 个单字和 20,000 个高频二元组，共 2,604 万条 postings。
4. 索引按 token 切成连续字节流，浏览器用 `Range: bytes=...` 只取查询涉及的几 KB，不下载整份索引。
5. `token-offsets.json`（0.8 MiB）记录每个 token 的偏移和长度，只在首次检索时加载。
6. 静态站不需要任何服务器函数；GitHub Pages 免费额度足够个人访问。

### 免费额度对照

| 项目 | 本站用量 | GitHub Pages | Cloudflare Free |
| --- | --- | --- | --- |
| 站点体积 | 约 226 MB | 1 GB | 静态资源无总量限制，单文件 25 MiB |
| 文件数 | 509 | 无硬限制（建议 < 1 GB） | 20,000 / 版本 |
| 单文件 | 最大 8.7 MiB | 小于 1 GB | 小于 25 MiB |
| 月带宽 | 按访问量 | 100 GB 软限制 | 100,000 请求/天 |

---

## 三、目录

```text
中国诗歌/
├─ server/
│  ├─ index.js                  # 本地零依赖 HTTP 服务：API + 静态资源 + SPA 回退
│  └─ data/
│     ├─ poems-01.tsv … 04      # 原始语料切片
│     ├─ authors.json           # 诗人档案
│     ├─ classics.json          # 14 部典籍
│     ├─ stats.json             # 统计、名句、每日池
│     ├─ s2t.json               # 简→繁映射
│     └─ token-index.sqlite     # 本地检索索引（生成，gitignore）
├─ tools/
│  ├─ build_corpus.py           # 原始 JSON → TSV / authors / stats
│  ├─ build_static_site.py      # 生成静态分片、诗人、飞花令、D1 SQL
│  ├─ build_range_index.py      # 生成 token-index.bin + token-offsets.json
│  ├─ prepare_cloudflare.js     # 复制运行期 JSON
│  ├─ prepare_pages.js          # 404.html / .nojekyll
│  ├─ prepare_edgeone.js        # EdgeOne 根路径、SPA 与索引分片
│  └─ build_fonts.py            # 字体子集
├─ deploy/
│  ├─ edgeone.json              # EdgeOne SPA 回退
│  └─ EDGEONE.md                # 可选：EdgeOne 部署
├─ cloudflare/
│  ├─ worker.js                 # /api/health + /api/search-candidates + 静态资源
│  ├─ token-schema.sql          # D1 检索表
│  ├─ token-index/              # D1 导入分块（生成，gitignore）
│  ├─ wrangler.toml
│  └─ CLOUDFLARE.md             # 可选：Cloudflare 部署
├─ web/
│  ├─ src/                      # React 源码
│  ├─ public/data/              # 静态数据（生成）
│  ├─ dist/                     # Cloudflare 构建（根路径）
│  ├─ dist-pages/               # GitHub Pages 构建（/chinese-poetry/ 前缀）
│  └─ dist-edgeone/             # EdgeOne 构建（根路径，25MB 分片）
├─ 启动网站.bat
├─ package.json
└─ README.md
```

---

## 四、本地运行

### 前置

- Node.js 18+
- Python 3（只在重建数据时需要）
- 首次安装前端依赖：`cd web && npm install`

### 启动

```powershell
npm start
```

访问 http://127.0.0.1:5177。

本地 Node 服务会读取 `server/data/token-index.sqlite`，提供 `/api/search-candidates`；前端优先走 API。

### 开发模式

```powershell
# 终端 1：本地 API + 静态资源（5177）
npm start

# 终端 2：Vite（5178，/api 代理到 5177）
cd web
npm run dev
```

### 构建

```powershell
npm run build          # Cloudflare 根路径版 web/dist
npm run build:pages    # GitHub Pages 子路径版 web/dist-pages
npm run edgeone:build  # EdgeOne 根路径版 web/dist-edgeone（含 25MB 分片）
npm run edgeone:zip    # 生成控制台上传用 molan-edgeone.zip
```

---

## 五、重建数据与索引

需要把 `chinese-poetry` 原始仓库放在 `D:\Source\Repos\chinese-poetry`，并安装：

```powershell
pip install opencc-python-reimplemented fonttools brotli
```

完整重建：

```powershell
npm run data                 # 语料 → TSV / authors / stats
python tools/build_static_site.py
python tools/build_range_index.py
```

`build_static_site.py` 生成：

- `web/public/data/poems/0001..0346.json`：345,386 首正文
- `web/public/data/poem-index-000..007.json`：浏览索引
- `web/public/data/poet-index.json`、`poet-bio/*.json`
- `web/public/data/daily.json`、`random.json`、`lines/<字>.json`
- `web/public/data/token-index.bin` 不在这里生成；下一步 `build_range_index.py` 会从 SQLite 导出
- `cloudflare/token-index/*.sql`：D1 导入分块

`build_range_index.py` 从 SQLite 生成：

- `web/public/data/token-index.bin`（30.9 MiB）
- `web/public/data/token-offsets.json`（0.8 MiB）
- 更新 `manifest.json` 中的 `rangeIndexBytes` 等字段

---

## 六、部署到 GitHub Pages

站点按项目页部署，仓库为 `gufengaoyue/chinese-poetry`，访问路径是 `/chinese-poetry/`。

### 1. 构建

```powershell
npm run pages:build
```

产物在 `web/dist-pages`，包含 `404.html` 和 `.nojekyll`，约 226 MB、509 个文件。

### 2. 推送到 `gh-pages`

```powershell
# 在仓库根目录
git worktree add --detach D:\temp\molan-gh-pages
cd D:\temp\molan-gh-pages
git checkout --orphan gh-pages
git rm -rf .
Copy-Item -Path D:\Source\Repos\中国诗歌\web\dist-pages\* -Destination . -Recurse -Force
git add -A
git commit -m "deploy: 墨澜 GitHub Pages"
git push --force origin gh-pages
```

### 3. 开启 Pages

在 GitHub 仓库 **Settings → Pages** 中：

- Source：`Deploy from a branch`
- Branch：`gh-pages` / `(root)`

或在 API 中设置：

```powershell
# 需要 repo 权限
gh api repos/gufengaoyue/chinese-poetry/pages -X PUT `
  -f source[branch]=gh-pages -f source[path]=/
```

首次构建约 2–3 分钟。构建完成后访问：

```text
https://gufengaoyue.github.io/chinese-poetry/
```

### 4. 更新站点

重跑 `npm run pages:build`，重新推送 `gh-pages` 即可。只需替换该分支，不影响 `main`。

> `gh-pages` 是一个只含构建产物的发布分支，不要在其中改源码。搜索不需要任何后端；生产构建直接使用静态 Range 索引，不再探测 `/api`。

---

## 七、可选：EdgeOne Pages

EdgeOne 使用根路径构建，产物在 `web/dist-edgeone`，与 GitHub Pages 的 `/chinese-poetry/` 子路径构建完全分开。

本地构建：

```powershell
npm run edgeone:build
npm run edgeone:zip
```

推送到 `main` 后，`.github/workflows/edgeone.yml` 会自动完成构建和部署；只需在 GitHub 仓库 secret 中配置 `EDGEONE_API_TOKEN`。没有 token 时 workflow 会构建但跳过上传，不报红。

关键点：

- `deploy/edgeone.json` 负责 SPA 路由回退与安全响应头；
- 30.9 MiB 的 `token-index.bin` 会按 token 边界拆成两个 16 MiB 以内的分片，并生成 `token-index.json` 清单；
- 前端按全局偏移选择分片，再对分片做局部 Range；
- EdgeOne 的默认域名只适合短期预览，长期访问需要绑定自定义域名；含中国大陆加速需 ICP 备案，不含中国大陆可选择海外节点。

完整步骤、限制和验收清单见 [`deploy/EDGEONE.md`](deploy/EDGEONE.md)；域名接入见 [`deploy/DOMAIN.md`](deploy/DOMAIN.md)；反爬配置见 [`deploy/EDGEONE-SECURITY.md`](deploy/EDGEONE-SECURITY.md)。

---

## 八、可选：Cloudflare 部署

Cloudflare 版保留作为海外镜像，使用 `worker.js` + Static Assets + 一个很小的 D1 检索表。详细步骤见 [`cloudflare/CLOUDFLARE.md`](cloudflare/CLOUDFLARE.md)。

已部署地址：

```text
https://molan-verse-archive.gufengaoyue.workers.dev
```

注意：`workers.dev` 在中国大陆常被 DNS 污染；若需要国内稳定访问，请使用 GitHub Pages 主站，或给 Cloudflare 绑定自定义域名。

---

## 九、数据来源与处理

原始数据来自 **chinese-poetry**（MIT License），包含全唐诗、全宋诗、全宋词、元曲、诗经、楚辞、花间集、南唐二主词、千家诗、水墨唐诗、纳兰词、曹操诗集等 12 部总集，以及论语、孟子、大学、中庸等 14 部典籍。

处理要点：

1. **统一简体**：原库中唐诗多为繁体、宋词多为简体，使用 OpenCC `t2s` 统一；站点再通过 `s2t.json` 按需还原繁体。
2. **合并诗人档案**：合并 `authors.tang`（3,675）、`authors.song`（8,934）与词人档案（1,563），同一诗人取最长传记。
3. **名篇标签**：`唐诗三百首`、`宋词三百首` 不单列集合，以标签并入对应作品。
4. **热度**：读取 `rank/poet`、`rank/ci` 中的检索量，按 `log10(baidu+google+bing+bing_en+so360+10)` 归一。
5. **去重取舍**：`御定全唐詩`（43,103 首，繁体且与全唐诗大量重复）不纳入主站；`strains`、`error` 目录弃用。
6. **人工校订**：48 条千古名句由人工挑选校对。

统计口径：诗人总数只计入确有作品的作者；同一诗人跨多个总集时分别归属朝代，不做合并。

---

## 十、本地 API

本地 `server/index.js` 提供与前端静态层同语义的接口，默认监听 `127.0.0.1:5177`：

| 路径 | 说明 |
| --- | --- |
| `/api/stats` / `/api/meta` | 总量、总集、朝代、诗人榜、词牌、字频、意象、篇幅、名句、每日池 |
| `/api/poems` | 分页列表；`coll` `dyn` `tag` `author` `q` `sort` `minLen` `maxLen` `page` `size` |
| `/api/poem/:id` | 作品详情、注释、赏析、作者档案、同作者 / 同词牌、前后篇 |
| `/api/poem/random` | 随机一首（可按 `coll` 限定） |
| `/api/poets` / `/api/poet/:id` | 诗人列表与详情 |
| `/api/search` | 全文检索 |
| `/api/lines` | 飞花令：单字 / 双字 |
| `/api/daily` | 今日诗笺，可按 `date=YYYY-MM-DD` 复现 |
| `/api/classics` / `/api/classics/:id` | 典籍目录与全文 |
| `/api/search-candidates` | 检索候选序号（仅本地 / Cloudflare） |

GitHub Pages 与 EdgeOne 都是无服务端静态版本。开发服务器下前端优先使用 `/api/search-candidates`；生产构建直接使用静态 Range 索引。GitHub Pages 用单个 `data/token-index.bin`；EdgeOne 用 `data/token-index.json` 清单加两个分片，前端会自动选择。

---

## 十一、验证记录

- 首页、诗库、诗页、诗人页、全文检索已在 GitHub Pages 线上截图验证。
- `/search?q=明月` 返回 **5,027 条**，与本地 D1 版本一致。
- 单字「月」检索正常；诗页正文、作者档案、同作者推荐正常。
- EdgeOne 根路径构建已验收：`/search?q=明月` 5,027 条，`/search?q=奇` 9,730 条；第二片 `token-index-001.bin` 的 Range 传输约 10 KB。GitHub Pages 线上仍使用旧的单文件 `token-index.bin`，未受影响。
- Git 提交：`gh-pages` 为发布分支；源码在 `main`。

## License

代码 MIT。语料来自 chinese-poetry，遵循其原始 MIT License。
