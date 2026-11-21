# 自有域名接入：tiongkok-poetry.cn

## 结论

`tiongkok-poetry.cn` 即使**没有 ICP 备案**，也可以绑定到 EdgeOne 的
「全球可用区（不含中国大陆）」项目。EdgeOne 官方规则是：

- 「中国大陆可用区」和「全球可用区（含中国大陆）」：自定义域名必须先完成 ICP 备案；
- 「全球可用区（不含中国大陆）」：自定义域名**不要求 ICP 备案**。

所以不需要服务器、不需要备案码，也不需要把域名转到境外注册商。代价是：网站只走中国大陆以外的节点，国内访问是跨境链路，速度是“可用但不保证快”，不能冒充大陆节点加速。

`.icu` 域名已绑定在别处，本项目不碰它；本文只处理 `tiongkok-poetry.cn`。

## 当前状态

| 项 | 值 |
| --- | --- |
| EdgeOne 项目 | `tiongkok-poetry-overseas` |
| 项目加速区域 | `overseas`（全球可用区，不含中国大陆） |
| 项目预设域名 | `tiongkok-poetry-overseas-ar1jrhgh.edgeone.dev` |
| 自定义域名 | `tiongkok-poetry.cn` |
| 域名状态 | `init`，等待归属验证 |
| 归属验证 TXT 主机记录 | `edgeonereclaim` |
| 归属验证 TXT 记录值 | `reclaim-8b99o181idi1yvrffxu6q5krcz0n01x4` |
| CNAME 目标 | 归属验证通过后由 EdgeOne 生成，当前为 `pending` |

绑定请求已经通过 EdgeOne API 创建成功，没有返回 `Domain no icp`；现在缺的只是 DNS 归属验证和 CNAME。

## 1. 在阿里云 DNS 添加归属 TXT

登录阿里云云解析 DNS 控制台，找到 `tiongkok-poetry.cn`，添加一条记录：

| 字段 | 填写 |
| --- | --- |
| 记录类型 | `TXT` |
| 主机记录 | `edgeonereclaim` |
| 解析请求来源 | 默认 |
| 记录值 | `reclaim-8b99o181idi1yvrffxu6q5krcz0n01x4` |
| TTL | 600（10 分钟） |

添加后等待 5–10 分钟，在 PowerShell 验证：

```powershell
Resolve-DnsName -Type TXT edgeonereclaim.tiongkok-poetry.cn
```

必须能看到 `reclaim-8b99o181idi1yvrffxu6q5krcz0n01x4`，再做下一步。

## 2. 在 EdgeOne 点“验证归属权”

进入 EdgeOne Makers 控制台 → 项目 `tiongkok-poetry-overseas` → **域名管理** →
`tiongkok-poetry.cn` → **验证归属权** → **验证**。

验证通过后，页面会给出该域名的 CNAME 目标。把它复制下来，进入第 3 步。

> 如果控制台暂时没有刷新出 CNAME，可在项目域名页重新打开该域名，或等几分钟再看；
> `tools/edgeone-domain.mjs` 也会在后续部署时重新读取 `domains.list()` 的 `cname` 字段。

## 3. 在阿里云 DNS 添加根域 CNAME

阿里云云解析支持根域名 CNAME（主机记录 `@`），但同一主机记录下不能同时存在
A / AAAA / MX / 其他 CNAME 冲突记录。当前 `tiongkok-poetry.cn` 根域只有 SOA，没有
A/AAAA/MX，因此可以直接加。

| 字段 | 填写 |
| --- | --- |
| 记录类型 | `CNAME` |
| 主机记录 | `@` |
| 解析请求来源 | 默认 |
| 记录值 | EdgeOne 控制台给出的 CNAME 目标（完整复制，不要改） |
| TTL | 600（10 分钟） |

如果以后这个根域要收邮件（有 MX 记录），不要再给 `@` 加 CNAME；改用
`www.tiongkok-poetry.cn` 绑定 EdgeOne，再用阿里云的 URL 转发把根域 301 到 `www`。
当前站点没有邮件需求，直接用根域即可。

## 4. 等 HTTPS 生效并验收

EdgeOne 会在 CNAME 生效后签发免费证书，域名状态从 `init` 变为已生效。然后检查：

```powershell
Resolve-DnsName tiongkok-poetry.cn
curl.exe -I https://tiongkok-poetry.cn/
curl.exe -I https://tiongkok-poetry.cn/data/token-index-001.bin
curl.exe https://tiongkok-poetry.cn/robots.txt
```

验收标准：

- 首页返回 200，`/library`、`/poem/tang-00001` 等 SPA 路由不 404；
- `/data/*` 带 `X-Robots-Tag: noindex`，Range 请求返回 206；
- `robots.txt` 可访问；
- 手机端首页不会恢复成 13,000px 的长页面。

## 5. 这条通道的边界

- 不需要 ICP，不等于“国内节点加速”。`overseas` 只分配中国大陆以外节点，
  国内访问速度取决于运营商国际出口，晚高峰可能波动；这是免备案方案无法消除的物理限制。
- 如果以后能拿到备案（个人也可以备案，但通常需要一台符合条件的境内服务器/接入商），
  再新建「中国大陆可用区」项目并重新绑定域名，才能获得大陆节点；当前项目不能直接改区域。
- 不要为了“绕过备案”把 `.cn` 解析到大陆 IP 或伪装成大陆节点；这属于违规接入，
  不是技术问题。

## 6. 自动部署与域名互不影响

`.github/workflows/edgeone.yml` 构建 ZIP 后部署到 `tiongkok-poetry-overseas`；
`.github/workflows/edgeone-domain.yml` 在部署成功后确保 `tiongkok-poetry.cn` 自定义域名存在。
域名绑定一次即可，之后 push `main` 只更新内容，不会丢域名。
