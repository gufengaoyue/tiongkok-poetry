# EdgeOne Pages（Makers）部署说明

EdgeOne 是独立于 GitHub Pages 的第二条发布通道。两边共用同一套源码和数据，但构建 base 不同：

- GitHub Pages：`/chinese-poetry/` → `web/dist-pages`
- EdgeOne：`/` → `web/dist-edgeone`

GitHub Pages 的 `gh-pages` 分支和线上站点不参与 EdgeOne 构建；只要不推送 `gh-pages`，EdgeOne 的任何操作都不会影响现有主站。

## 1. 本地构建

```powershell
npm run edgeone:build
```

这条命令依次执行：

1. `python tools/build_static_site.py`
2. `python tools/build_range_index.py`
3. `vite build --base=/ --outDir dist-edgeone`
4. `node tools/prepare_edgeone.js`

产物在 `web/dist-edgeone`。当前规模：**510 个文件、226.2 MB**。

> Windows 下如果开发服务器占着 `web/public/data/lines`，构建可能报目录占用。先停掉 `npm --prefix web run dev`，再构建。

## 2. 25 MB 索引限制

EdgeOne 单个文件上限是 25 MB，而完整检索索引 `token-index.bin` 约 30.9 MiB（32,385,521 字节），不能直接上传。`prepare_edgeone.js` 会按 token 边界拆分：

- `data/token-index-000.bin`：16,773,842 字节
- `data/token-index-001.bin`：15,611,679 字节
- `data/token-index.json`：清单，记录每片的 `start` 和 `bytes`
- 删除 `data/token-index.bin`

前端 `web/src/api.ts` 会读取清单，按全局偏移选择分片，再对分片做局部 HTTP Range。EdgeOne 上实测 `token-index-001.bin` 的一次检索只传输约 **10 KB**，不是整片 15.6 MB。

GitHub Pages 的构建仍保留单个 `token-index.bin`；前端在没有 `token-index.json` 时自动回退到旧路径。

## 3. 自动部署（推荐）

仓库已包含 `.github/workflows/edgeone.yml`。推送到 `main` 后，GitHub Actions 会：

1. `npm ci --prefix web`
2. `npm run edgeone:build`
3. `npm run edgeone:zip`
4. 用 `edgeone makers deploy molan-edgeone.zip -n chinese-poetry -t <token>` 更新现有 EdgeOne 生产项目

这套方案不改变当前项目的「直接上传」类型，也不依赖 EdgeOne 自己的 Git 构建环境；构建在 GitHub 的 Windows runner 上完成，所以 `server/data` 里已提交的 8 个语料文件、Python、Vite 和 `pwsh` 都可控。

### 3.1 一次性配置 API Token

1. 打开 EdgeOne Makers 控制台 → **设置 → API Token**，创建一个 Token（只需部署权限）。
2. 打开 GitHub 仓库 **Settings → Secrets and variables → Actions → New repository secret**。
3. 名称填 `EDGEONE_API_TOKEN`，值粘贴刚创建的 Token。

没有配置这个 secret 时，workflow 仍会完成构建，并在日志里给出 warning，但会跳过部署；配置后下一次 push 就会自动上线。

### 3.2 手动兜底

```powershell
git pull
npm run edgeone:build
npm run edgeone:zip
```

控制台「构建部署 → 新建部署」上传 `molan-edgeone.zip` 到生产环境；或用 CLI：

```powershell
npx edgeone makers deploy molan-edgeone.zip -n chinese-poetry
```

CLI 会自己生成 `.edgeone` 临时目录；这个目录已被 `.gitignore` 忽略，不要放进最终 ZIP。

## 4. 必须保留的 EdgeOne 设置

`deploy/edgeone.json` 会在构建时复制到产物根目录：

```json
{
  "rewrites": [
    { "source": "/*", "destination": "/index.html" }
  ]
}
```

这是 SPA 回退。`/library`、`/poem/tang-00001`、`/search?q=明月` 等前端路由都依赖它；静态资源命中时优先返回文件，未命中才回 `index.html`。

## 5. 域名与加速区域

EdgeOne 的默认域名有访问期限，长期使用需要绑定自己的域名：

- **不含中国大陆（global / 海外）**：默认域名通常只用于短期预览；绑定自定义域名后可以长期访问，自定义域名不强制 ICP，但走境外节点。中国大陆访问默认域名可能返回 401。
- **含中国大陆（china）**：稳定使用默认域名或自定义域名，需要已完成 ICP 备案的域名；没有备案时不要选这个区域。

如果只是先验证站点，用 global 预览即可；要长期给国内读者访问，建议：

1. 准备一个已备案域名，创建「含中国大陆」项目；或
2. 接受境外节点，绑定一个未备案自定义域名到 global 项目。

### 默认域名能不能改成 `chinese-poetry.edgeone.dev`？

不能直接改。Pages 的项目域名在创建时分配，**项目名称不会改变默认访问域名**；`edgeone.dev` 是平台自己的域名，无法用它做自定义域名的归属验证，所以不能绑定到当前 Makers 项目。

想要更短的 `.edgeone.dev` 地址，只能看 Makers Drop 的独立入口：Drop 页面可以填写自定义子域并上传静态文件，但它是另一套托管方式，不是当前 Makers 项目；需要重新部署并验证 SPA 回退、Range 检索和文件数量限制。若只是要长期稳定地址，绑定自己的域名更可靠。

### 加速区域能不能改成中国大陆？

不能直接改。加速区域在创建项目时确定，之后没有切换入口；要大陆节点只能新建项目时选「中国大陆可用区」或「全球可用区（含中国大陆）」，并绑定已完成 ICP 备案的域名。

当前「全球可用区（不含中国大陆）」是适合无备案场景的选择：非中国大陆网络可直接访问，中国大陆访问默认域名会 401；绑定自定义域名后走境外节点，不强制备案。

## 6. GitHub 更新后会同步吗？

**会，但同步动作在 GitHub Actions，不是 EdgeOne 的内置 Git 集成。** 当前 EdgeOne 项目仍是「直接上传」类型；`.github/workflows/edgeone.yml` 在 `main` 更新后构建 ZIP，并用 API Token 调用 `edgeone makers deploy`，效果等同于自动发布。

前提只有两个：

1. GitHub 仓库 secret 里已配置 `EDGEONE_API_TOKEN`；
2. workflow 运行成功（构建、打包、上传都不报错）。

不需要在 EdgeOne 控制台里点「新建部署」，也不需要把 `gh-pages` 推到 EdgeOne。GitHub Pages 仍然由 `gh-pages` 独立发布，两条链路互不影响。

> 如果以后把 EdgeOne 项目改成 Git 集成或新建了大陆项目，仍可继续用这套 workflow，只需改 `.github/workflows/edgeone.yml` 顶部的 `EDGEONE_PROJECT` 和 `-a` 区域参数。

## 7. 验收清单

部署后至少检查：

- `/` 首页统计最终显示 **345,386 首 / 13,733 位诗人 / 21,834,450 字**
- `/search?q=明月` 返回 **5,027 条**
- `/search?q=奇` 返回 **9,730 条**，确认第二片 `token-index-001.bin` 被使用
- 浏览器 Network 中 `token-index-001.bin` 的传输大小约 10 KB，而不是 15.6 MB
- `/poem/tang-00001`、`/library`、`/atlas` 直接打开不 404
- 墨金 / 米白主题切换可用

## 8. 不影响 GitHub Pages

EdgeOne 相关改动只新增：

- `web/dist-edgeone`（构建产物，已忽略）
- `deploy/edgeone.json`
- `tools/prepare_edgeone.js`
- `.github/workflows/edgeone.yml`
- `web/public/robots.txt`
- `deploy/EDGEONE-SECURITY.md`
- `web` / 根目录的 `build:edgeone`、`edgeone:build`、`edgeone:zip` 脚本

GitHub Pages 仍然使用：

```powershell
npm run pages:build
```

产物仍是 `web/dist-pages`，仍包含单文件 `token-index.bin` 和 `404.html`。EdgeOne 构建不会修改 `gh-pages`，也不会删除 `web/public/data/token-index.bin`。
