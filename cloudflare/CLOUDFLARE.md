# 墨澜 · Cloudflare Workers & Pages 部署

本站采用 **Workers Static Assets + D1**：

- 前端：`web/dist` 由 Workers Static Assets 托管，`ASSETS` binding。
- API：`cloudflare/worker.js` 接管 `/api/*`。
- 数据：D1（SQLite）保存 34.5 万首诗、1.37 万位诗人与飞花令索引，`DB` binding。
- 检索：D1 的 FTS5 虚拟表 `poems_fts`，中文按单字空格化后用 phrase 查询。

> 语料已按记录边界拆成 4 个 `server/data/poems-*.tsv`，每片 21.83 MiB，低于 Cloudflare 单文件 25 MiB 限制。原 87.32 MiB 的 `poems.tsv` 已删除。

## 1. 本地准备种子

```powershell
python tools/build_cloudflare_seed.py --sqlite cloudflare/molan.sqlite
node tools/test_cloudflare_worker.mjs
```

第一条命令会生成：

```
cloudflare/seed/010-authors.sql
cloudflare/seed/020-poems-01.sql … 020-poems-04.sql
cloudflare/seed/030-lines.sql
```

同时生成 `cloudflare/molan.sqlite` 用于本地验证。种子文件是 D1 导入文件，**不需要提交到 Git**。

## 2. 创建 D1 数据库

```powershell
npx wrangler d1 create molan-poetry
```

把输出里的 `database_id` 填进 `cloudflare/wrangler.toml` 的 `[[d1_databases]]` 段。然后：

```powershell
npx wrangler d1 execute molan-poetry --remote -c cloudflare/wrangler.toml --file=cloudflare/schema.sql
Get-ChildItem cloudflare\seed\*.sql | Sort-Object Name | ForEach-Object {
  npx wrangler d1 execute molan-poetry --remote -c cloudflare/wrangler.toml --file="$($_.FullName)"
}
```

四个诗库分片各约 55 MiB 的 SQL，若某次导入被网络中断，重新执行该文件即可；`schema.sql` 开头会 `DROP TABLE`，只适合新库或重建，**不要**在已有数据的库上重复执行。首次导入按顺序执行，通常需要数分钟。

## 3. 本地预览 Worker

```powershell
npx wrangler d1 execute molan-poetry --local -c cloudflare/wrangler.toml --file=cloudflare/schema.sql
Get-ChildItem cloudflare\seed\*.sql | Sort-Object Name | ForEach-Object {
  npx wrangler d1 execute molan-poetry --local -c cloudflare/wrangler.toml --file="$($_.FullName)"
}
npm run cf:build
npx wrangler dev -c cloudflare/wrangler.toml
```

`cf:build` 会先把 `server/data/stats.json`、`classics.json`、`s2t.json` 复制到 `web/public/data/`，再构建前端。Worker 用 `ASSETS.fetch('/data/stats.json')` 读取它们，缺文件会导致所有 `/api/*` 返回 500。

## 4. 部署

```powershell
npm run cf:build
npx wrangler deploy -c cloudflare/wrangler.toml
```

## 5. 数据更新

修改原始语料后：

```powershell
npm run data          # 重建 TSV 并自动切成 4 片
python tools/build_cloudflare_seed.py
npm run cf:build
```

再按第 2 节重新导入种子（先重建表）。

## 目录

| 路径 | 作用 |
| --- | --- |
| `cloudflare/worker.js` | Worker 入口与全部 `/api/*` 路由 |
| `cloudflare/schema.sql` | D1 表结构、索引、FTS5 虚拟表 |
| `cloudflare/wrangler.toml` | Workers 配置，含 `ASSETS` 与 `DB` binding |
| `tools/build_cloudflare_seed.py` | 生成 D1 种子 SQL，可选生成本地 SQLite |
| `tools/prepare_cloudflare.js` | 复制运行期 JSON 到 `web/public/data` |
| `tools/test_cloudflare_worker.mjs` | 用 `node:sqlite` 模拟 D1，跑全路由验证 |
