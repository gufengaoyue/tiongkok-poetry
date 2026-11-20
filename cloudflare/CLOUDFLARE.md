# 墨澜 · Cloudflare Workers 部署

本站采用 **Workers Static Assets + D1**：

- 前端：`web/dist` 由 Workers Static Assets 托管，`ASSETS` binding。
- API：`cloudflare/worker.js` 接管 `/api/*`。
- 数据：D1（SQLite）保存 34.5 万首诗、1.37 万位诗人与飞花令索引，`DB` binding。
- 检索：D1 的 FTS5 虚拟表 `poems_fts`，中文按单字空格化后用 phrase 查询。

> 语料已按记录边界拆成 4 个 `server/data/poems-*.tsv`，每片 21.83 MiB，低于 Cloudflare 单文件 25 MiB 限制。原 87.32 MiB 的 `poems.tsv` 已删除。

## 0. 账号要求

全量导入的写入量约 350 万行以上，**D1 Free 的 100,000 行/天写入额度不够**；D1 Free 单库上限 500 MB，本库本地约 390 MiB，余量也很小。

请使用 **Workers Paid（$5/月）**：D1 单库上限 10 GB，包含每月 5,000 万行写入。具体额度以 Cloudflare 控制台当前显示为准。

另外，D1 单条 SQL 语句上限为 **100,000 字节**。`tools/build_cloudflare_seed.py` 会按约 70 KB 自动切批，不需要手工处理。

## 1. 本地生成种子与分块

```powershell
python tools/build_cloudflare_seed.py
python tools/split_d1_sql.py --max-mb 8
```

第一条命令生成：

```
cloudflare/seed/010-authors.sql
cloudflare/seed/020-poems-01.sql … 020-poems-04.sql
cloudflare/seed/030-lines.sql
```

第二条命令把每个 SQL 再按完整语句切成约 8 MiB 的小块：

```
cloudflare/seed/chunks/010-authors-001.sql
cloudflare/seed/chunks/020-poems-01-001.sql …
cloudflare/seed/chunks/030-lines-001.sql
```

种子和分块都**不需要提交到 Git**。

本地验证：

```powershell
python tools/build_cloudflare_seed.py --sqlite cloudflare/molan.sqlite
node tools/test_cloudflare_worker.mjs
```

## 2. 创建 D1 数据库

```powershell
npx --yes wrangler@latest d1 create molan-poetry
```

把输出里的 `database_id` 填进 `cloudflare/wrangler.toml` 的 `[[d1_databases]]` 段：

```toml
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 3. 导入表结构与分块种子

先导 schema：

```powershell
npx --yes wrangler@latest d1 execute molan-poetry --remote -c cloudflare/wrangler.toml --file=cloudflare/schema.sql
```

再按文件名顺序导入所有小块：

```powershell
Get-ChildItem cloudflare\seed\chunks\*.sql | Sort-Object Name | ForEach-Object {
  npx --yes wrangler@latest d1 execute molan-poetry --remote -c cloudflare/wrangler.toml --file="$($_.FullName)"
}
```

注意：

- `schema.sql` 开头会 `DROP TABLE`，**只适合新库或重建库**，已有数据的库不要重复执行。
- 分块必须按文件名顺序导入：`010-authors` → `020-poems-01…04` → `030-lines`。
- 每块约 8 MiB，D1 导入通常几十秒到几分钟。若某块中断，先核对行数再决定补导，不要盲目重复导入。
- 导入完成后核对：

```powershell
npx --yes wrangler@latest d1 execute molan-poetry --remote -c cloudflare/wrangler.toml --command="SELECT (SELECT COUNT(*) FROM poems) AS poems, (SELECT COUNT(*) FROM authors) AS authors, (SELECT COUNT(*) FROM poems_fts) AS fts;"
```

期望：`poems=345386`、`authors=13733`、`fts=345386`。

## 4. 构建并部署

```powershell
npm run cf:build
npx --yes wrangler@latest deploy -c cloudflare/wrangler.toml
```

部署成功后终端会输出站点 URL：

```text
https://molan-verse-archive.<你的子域>.workers.dev
```

## 5. 数据更新

修改原始语料后：

```powershell
npm run data
python tools/build_cloudflare_seed.py
python tools/split_d1_sql.py --max-mb 8
npm run cf:build
```

再按第 3 节重新导入（先重建表）。

## 目录

| 路径 | 作用 |
| --- | --- |
| `cloudflare/worker.js` | Worker 入口与全部 `/api/*` 路由 |
| `cloudflare/schema.sql` | D1 表结构、索引、FTS5 虚拟表 |
| `cloudflare/wrangler.toml` | Workers 配置，含 `ASSETS` 与 `DB` binding |
| `tools/build_cloudflare_seed.py` | 生成 D1 种子 SQL，可选生成本地 SQLite |
| `tools/split_d1_sql.py` | 把种子 SQL 按完整语句切成约 8 MiB 小块 |
| `tools/prepare_cloudflare.js` | 复制运行期 JSON 到 `web/public/data` |
| `tools/test_cloudflare_worker.mjs` | 用 `node:sqlite` 模拟 D1，跑全路由验证 |
