# 墨澜 · MOLAN — 中国古典诗词数字档案

> 三千载诗心，一屏可揽。

墨澜基于开源项目 [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) 构建，把散落在 JSON 中的诗、词、曲、经、典籍整理成可检索、可漫游、可做数据观察的网站。

**规模**：345,386 首作品 · 13,733 位诗人 · 1,580,038 行 · 21,834,450 字 · 1,476 个词牌 · 12 部总集 · 14 部典籍。

## 在线地址

| 项 | 值 |
| --- | --- |
| 站点 | `https://tiongkok-poetry.cn`（EdgeOne 海外节点，归属验证中） |
| EdgeOne 项目 | `tiongkok-poetry-overseas`（`overseas`，全球可用区不含中国大陆） |
| 自动部署分支 | `main` |
| 当前部署方式 | GitHub Actions 构建 ZIP，调用 EdgeOne Makers SDK 发布到 `Production` |

> `gh-pages` 不是 EdgeOne 的部署分支。EdgeOne 只监听 `main`；`git commit` 本身不会发布，必须 `git push origin main`。

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

## 免费架构

站点不依赖付费 Worker、不依赖数据库全库，全部运行在免费额度内：

```text
浏览器
  ├─ 静态页面 / 字体 / 样式         EdgeOne Pages
  ├─ 诗库正文分片                   /data/poems/0001..0346.json
  ├─ 浏览索引（8 段）               /data/poem-index-000..007.json
  ├─ 诗人 / 每日 / 随机 / 飞花令    /data/*.json
  └─ 全文检索
       └─ HTTP Range 读取 /data/token-index-000.bin + 001.bin
```

关键点：

1. 诗库正文按 1,000 首一片切成 346 个 JSON，单文件约 300 KB，页面按需读取。
2. 浏览索引切成 8 段，每段约 43,174 首，低于平台单文件限制。
3. 全文检索索引约 30.9 MiB，包含 12,682 个单字和 20,000 个高频二元组，共 2,604 万条 postings。
4. 索引按 token 切成连续字节流，浏览器用 `Range: bytes=...` 只取查询涉及的几 KB，不下载整份索引。
5. `token-offsets.json`（0.8 MiB）记录每个 token 的偏移和长度，只在首次检索时加载。
6. 静态站不需要任何服务端函数；EdgeOne 免费额度足够个人访问。

## 目录

```text
中国诗歌/
├─ server/
│  ├─ index.js                  # 本地零依赖 HTTP 服务：API + 静态资源 + SPA 回退
│  └─ data/                     # 语料切片、作者、典籍、统计、简繁映射
├─ tools/
│  ├─ build_corpus.py           # 原始 JSON → TSV / authors / stats
│  ├─ build_static_site.py      # 静态分片、诗人、飞花令
│  ├─ build_range_index.py      # token-index.bin / token-offsets.json / EdgeOne 分片
│  ├─ prepare_edgeone.js        # EdgeOne 根路径、SPA 与索引分片
│  ├─ edgeone-deploy-overseas.mjs # Makers SDK 部署到 overseas 项目
│  ├─ edgeone-domain.mjs        # 自定义域名绑定与 DNS 记录输出
│  ├─ zip_edgeone.ps1           # 生成上传 ZIP
│  └─ build_fonts.py            # 字体子集
├─ deploy/
│  ├─ edgeone.json              # SPA 回退 + 安全响应头
│  ├─ EDGEONE.md                # EdgeOne 部署说明
│  ├─ EDGEONE-SECURITY.md       # 反爬 / WAF 清单
│  └─ DOMAIN.md                 # 自定义域名接入
├─ web/
│  ├─ src/                      # React 源码
│  ├─ public/                   # 字体、robots、小型运行期数据
│  └─ dist-edgeone/             # EdgeOne 构建产物（gitignore）
├─ .github/workflows/
│  ├─ edgeone.yml               # push main → 构建 → 部署 Production
│  └─ edgeone-domain.yml        # 部署成功后确保自定义域名
├─ package.json
└─ README.md
```

> 旧的 Cloudflare / GitHub Pages 发布配置已从 Git 移除；本机文件保留在本地，不再上传。

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

## 构建与发布

```powershell
npm run edgeone:build   # 生成 web/dist-edgeone
npm run edgeone:zip     # 生成 molan-edgeone.zip
```

推送到 `main` 后，`.github/workflows/edgeone.yml` 会自动执行：

```text
npm ci --prefix web
npm run edgeone:build
npm run edgeone:zip
node tools/edgeone-deploy-overseas.mjs
```

部署目标是 `tiongkok-poetry-overseas` 的 `Production` 环境。`main` 更新才会触发；`gh-pages` 不参与 EdgeOne 发布。

## 域名与访问区域

`tiongkok-poetry.cn` 未备案，因此使用 EdgeOne 的 `overseas` 区域（全球可用区，不含中国大陆）。该区域绑定自定义域名不要求 ICP，但只走大陆以外节点；国内访问是跨境链路，速度不承诺。

**免备案不等于大陆加速。** 要使用大陆节点，必须先完成 ICP 备案并新建「中国大陆可用区」项目；当前项目不能直接改区域。

域名归属 TXT、CNAME 和验收步骤见 [`deploy/DOMAIN.md`](deploy/DOMAIN.md)。

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
