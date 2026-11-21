# 反爬与边缘防护

墨澜是公开的古典诗词站，正文、索引和数据分片最终都要送到浏览器。**没有任何前端代码能让公开静态资源变成“不可下载”**；真正有效的层次是 EdgeOne 的边缘规则、速率限制和抓取成本控制。本文给出当前可落地的配置，不把“加了 robots”当成安全边界。

## 已随代码生效的部分

1. `web/public/robots.txt`
   - 禁止爬虫抓取 `/data/`、`/api/`、`/search`，公开页面仍可被搜索引擎索引。
   - 对 GPTBot、ClaudeBot、CCBot、Bytespider、Amazonbot、meta-externalagent 单独禁止。
2. `deploy/edgeone.json`
   - 全站：`X-Content-Type-Options`、`X-Frame-Options: DENY`、`Referrer-Policy`、`Permissions-Policy`、CSP。
   - `/data/*`：`X-Robots-Tag: noindex, nofollow, noarchive`，避免索引 JSON 分片。
   - `/assets/*`：一年 immutable 缓存；`/data/*` 缓存一天。
3. GitHub Pages 没有自定义响应头能力；而且项目页的 `robots.txt` 位于 `/chinese-poetry/` 子路径，不是域根，搜索引擎不会按标准读取。因此这套反爬/headers 只在 EdgeOne 自定义域名上真正生效。

## EdgeOne 控制台需要配置的规则

路径：EdgeOne 控制台 → 项目 → **安全防护 → Web 防护 → 自定义规则**。免费版所有防护策略合计只有 5 条，其中速率限制只有 1 条，所以按优先级配置。

| 优先级 | 规则 | 匹配 | 动作 |
|---|---|---|---|
| 1 | `数据分片限速` | 请求路径 `Path` 包含 `/data/`；统计维度：客户端 IP；1 分钟超过 90 次 | JavaScript 挑战，持续 10 分钟；没有挑战动作时先用观察 |
| 2 | `脚本 UA 拦截` | User-Agent 包含 `python-requests`、`curl/`、`Wget/`、`Scrapy`、`Go-http-client`、`Java/`、`HeadlessChrome`、`Playwright`、`Puppeteer` | 拦截 |
| 3 | `空 UA 观察` | User-Agent 为空 | 先观察 24 小时；确认没有正常客户端后再拦截 |
| 4 | `异常 Referer`（可选） | 请求路径包含 `/data/`，且 Referer 不包含你的正式域名、也不为空 | 观察，确认后再拦截 |

注意：

- **不要把空 Referer 全站拦截**，用户直接打开页面、从收藏夹进入时都可能没有 Referer。
- **不要拦截 Googlebot / Bingbot / 百度蜘蛛**，否则正常收录会消失；UA 规则只列脚本型 UA。
- 限速只针对 `/data/`，不要对 HTML、CSS、JS 限速，否则首屏会被误伤。
- 速率阈值 90 次/分钟对正常阅读足够宽松：一页通常只读取索引、少量分片和 4 个左右正文分片；搜索会触发 Range 请求，但不会持续高频。
- EdgeOne 的“基础访问管控”规则和“速率限制”规则共用配额；如果控制台提示超限，优先保留第 1、2 条。

## 验收

部署到自定义域名后：

```powershell
# 1. 响应头
curl.exe -I https://你的域名/

# 2. 数据分片应返回 noindex，且支持 Range
curl.exe -I https://你的域名/data/token-index-001.bin
curl.exe -I -H "Range: bytes=0-1023" https://你的域名/data/token-index-001.bin

# 3. robots
curl.exe https://你的域名/robots.txt
```

预期：

- 首页有 CSP、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`。
- `/data/*` 有 `X-Robots-Tag: noindex, nofollow, noarchive`；Range 返回 `206`。
- 高频请求 `/data/` 后出现 JavaScript 挑战或 403；正常刷新首页、检索、阅读详情不受影响。

## 边界

公开诗词数据本身可以被人手动复制，反爬的目标是阻止**批量、自动化、低成本**抓取，而不是阻止读者阅读。若以后需要真正的内容保护，路径是：将正文改为服务端鉴权/签名 URL，或对高频访问启用更严格的 WAF 挑战；仅靠静态站点无法做到绝对防复制。
