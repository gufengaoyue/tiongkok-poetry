# 墨澜 · Cloudflare 免费部署（备用通道）

> **国内主站是 GitHub Pages：https://gufengaoyue.github.io/chinese-poetry/**
> 当前网络下 `*.workers.dev` 被 DNS 污染，Cloudflare 版本只适合海外访问或绑定自定义域名后使用。纯静态、无 Worker 的 GitHub Pages 部署见根目录 `README.md`。

本站采用 **Workers Static Assets + 极小 D1 检索索引**，全部运行在 Cloudflare 免费额度内：

- 诗库正文：`web/public/data/poems/NNNN.json`，每片 1000 首，共 346 片，静态托管。
- 浏览索引：`web/public/data/poem-index-000..007.json`，只含卡片、排序、筛选字段。
- 诗人、典籍、飞花令、每日诗、随机池：全部是静态 JSON，按需加载。
- 全文检索：D1 只存一张 `token_index`（单字 + 高频二元组 → 诗序号），**不存诗库正文**。
- Worker 只保留一个动态接口：`/api/search-candidates`，返回命中的诗序号；前端再按序号读取静态分片并排序。

这样既不需要 Workers Paid，也不会把 87 MiB 语料塞进 Worker 或一次下载全量。

## 免费额度对照

| 项目 | 本站用量 | Free 限制 |
| --- | --- | --- |
| Worker 请求 | 只有检索候选接口 | 100,000 次/天 |
| 静态资源文件数 | 约 500 个 | 20,000 个/版本 |
| 单文件大小 | 最大约 8.7 MiB | 25 MiB |
| D1 表行数 | 32,746 行 | 无单表行数限制；Free 100,000 行/天写入 |
| D1 数据体积 | 约 31 MiB BLOB（加索引约 50–70 MB） | 500 MB/库 |
| D1 单条 SQL | 最大约 90 KB | 100 KB |

D1 只在**首次部署或语料更新**时写入；日常访问只读，不消耗写入额度。

## 1. 构建静态数据

```powershell
npm run cf:index
```

等价于：

```powershell
python tools/build_static_site.py
python tools/build_range_index.py
```

`npm run cf:index` 会依次执行上面两条命令：先生成 SQLite / D1 索引，再生成 GitHub Pages 用的 Range 索引。

生成：

```text
web/public/data/poem-index.json          # 8 个分片的清单
web/public/data/poem-index-000..007.json # 浏览索引
web/public/data/id-order.json            # 诗 id → 序号
web/public/data/poems/0001..0346.json    # 346 个正文分片
web/public/data/poet-index.json
web/public/data/poet-bio/0000..0013.json
web/public/data/daily.json
web/public/data/random.json
web/public/data/lines/<字>.json
web/public/data/{stats,classics,s2t}.json
```

同时生成检索索引：

```text
server/data/token-index.sqlite           # 本地开发用
cloudflare/token-schema.sql
cloudflare/token-index/0001..0008.sql    # D1 导入分块，约 64 MiB
```

分词索引的 `ids` 用 **delta varint** 编码，一条 BLOB 最大约 44 KB，既低于 D1 100 KB 单语句限制，也避免 200 MB 的十六进制原始数组。

## 2. 创建 D1 检索库

```powershell
npx --yes wrangler@latest d1 create molan-search
```

把返回的 `database_id` 写进 `cloudflare/wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "molan-search"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 3. 导入表结构与索引

先导 schema：

```powershell
npx --yes wrangler@latest d1 execute molan-search --remote `
  -c cloudflare/wrangler.toml --file=cloudflare/token-schema.sql --yes
```

再按文件名顺序导入：

```powershell
Get-ChildItem cloudflare\token-index\*.sql | Sort-Object Name | ForEach-Object {
  npx --yes wrangler@latest d1 execute molan-search --remote `
    -c cloudflare/wrangler.toml --file="$($_.FullName)" --yes
}
```

注意：

- `token-schema.sql` 会 `DROP TABLE token_index`，只适合新库或重建索引。
- 32,746 行大约消耗 65,000 行写入额度；Free 每日 100,000 行，**一天内可以完成**。
- 导入期间不要重复点击或并行导入；若某块中断，先核对 `SELECT COUNT(*) FROM token_index`，再补导。
- 如果本机已安装 `wrangler`，把上面的 `npx --yes wrangler@latest` 换成 `wrangler` 即可；仓库的 `cloudflare/package.json` 也带有本地 wrangler。

导入完成后核对：

```powershell
npx --yes wrangler@latest d1 execute molan-search --remote `
  -c cloudflare/wrangler.toml `
  --command="SELECT COUNT(*) AS rows, COUNT(DISTINCT token) AS tokens FROM token_index;"
```

期望 `rows=32746`、`tokens=32682`。

## 4. 本地验证

```powershell
npm start
```

访问 `http://127.0.0.1:5177`。本地 Node 服务会直接读取 `server/data/token-index.sqlite`，不需要连云端 D1。

检索接口单独验证：

```text
http://127.0.0.1:5177/api/search-candidates?q=明月
```

## 5. 构建并部署

```powershell
npm run cf:build
npx --yes wrangler@latest deploy -c cloudflare/wrangler.toml
```

`cf:build` 会依次生成静态数据、复制运行期 JSON、构建前端。静态资源约 190 MB，首次上传会稍慢；文件数和单文件大小都在 Free 限额内。

部署后终端会输出：

```text
https://molan-verse-archive.<你的子域>.workers.dev
```

线上验证：

```text
https://molan-verse-archive.<你的子域>.workers.dev/api/health
https://molan-verse-archive.<你的子域>.workers.dev/api/search-candidates?q=明月
https://molan-verse-archive.<你的子域>.workers.dev/search?q=明月
```

## 6. 数据更新

修改 `server/data/poems-*.tsv` 后：

```powershell
npm run cf:index
npm run cf:build
```

检索索引会重新生成。因为 token 的 postings 变了，需要：

1. 重新执行 `cloudflare/token-schema.sql` 清空表；
2. 按第 3 节重新导入 `cloudflare/token-index/*.sql`；
3. 再部署 Worker 与静态资源。

如果只改前端样式、不改语料，只需 `npm run build` 后重新 `wrangler deploy`，不必动 D1。

## 目录

| 路径 | 作用 |
| --- | --- |
| `cloudflare/worker.js` | 静态站点入口 + `/api/search-candidates` |
| `cloudflare/token-schema.sql` | D1 检索索引表结构 |
| `cloudflare/token-index/*.sql` | D1 导入分块（构建生成，已 gitignore） |
| `cloudflare/wrangler.toml` | Workers / Static Assets / D1 binding |
| `tools/build_static_site.py` | 生成全部静态数据与检索索引 |
| `tools/reencode_tokens.py` | 把旧的 uint32 postings 迁移为 delta varint（一次性） |
| `web/src/api.ts` | 浏览器静态数据层：索引、分片、检索、诗人、飞花令 |
| `server/data/token-index.sqlite` | 本地检索索引（构建生成，已 gitignore） |

## 旧方案

`cloudflare/schema.sql`、`tools/build_cloudflare_seed.py`、`tools/split_d1_sql.py` 是早期“D1 存全库 + FTS5 + Workers Paid”的方案，保留作历史参考，当前部署不需要执行。
