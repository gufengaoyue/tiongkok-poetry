# 自有域名接入准备

本次目标：

- 域名：`tiongkok-poetry.cn`（已备案）
- DNS：阿里云 `dns1.hichina.com` / `dns2.hichina.com`
- EdgeOne 项目：`tiongkok-poetry`（自动部署已创建）
- 推荐先绑定 `www.tiongkok-poetry.cn`，根域做 URL 转发；如果阿里云支持根域 CNAME/ALIAS，再直接绑根域

这份文档对应「注册自己的域名后，把 EdgeOne 站点换成长期域名」。代码和自动部署已经准备好，域名注册完成后只需要在控制台做归属验证和 DNS 解析。

## 1. 选哪种域名

- 建议使用独立子域，例如 `poetry.example.com` 或 `www.example.com`，不要和邮箱、主站共用根域。
- 当前 EdgeOne 项目是「全球可用区（不含中国大陆）」：自定义域名不强制 ICP 备案，但中国大陆访问会走境外节点。
- 如果以后要中国大陆节点：需要**已完成 ICP 备案**的域名，并在 EdgeOne 新建「含中国大陆」项目；当前项目不能直接改加速区域。

## 2. 在 EdgeOne 添加域名

1. 进入 EdgeOne Makers 控制台 → 项目 `tiongkok-poetry` → **域名管理**。
2. 点击「添加自定义域名」，填入 `www.tiongkok-poetry.cn`。
3. 当前项目区域为 global；系统会给出**归属验证值**和 **CNAME 目标**，以控制台显示为准。
4. 如果控制台要求归属验证：到阿里云 DNS 添加一条 `TXT` 记录，主机记录和值照控制台复制。
5. 验证通过后，添加 `CNAME` 记录指向控制台给出的目标。
   - 主机记录：`www`
   - 记录类型：`CNAME`
   - 记录值：EdgeOne 控制台提供的 CNAME 目标
   - 根域 `tiongkok-poetry.cn` 在阿里云不建议直接填 CNAME；可在阿里云做 URL 转发到 `https://www.tiongkok-poetry.cn/`，或使用支持根域 CNAME 展平的 DNS 服务。
6. 等待 DNS 生效，EdgeOne 自动签发 HTTPS 证书；状态变为「已生效」后访问 `https://www.tiongkok-poetry.cn/`。

## 3. 自动部署与域名互不影响

`.github/workflows/edgeone.yml` 部署的是同一个 EdgeOne 项目 `tiongkok-poetry`，所以：

- 域名绑定一次即可；
- 以后 push `main` 自动更新的是项目内容，不会丢域名；
- 无需把域名写进仓库，也不需要把 `gh-pages` 推到 EdgeOne。

如果为了大陆节点另建项目，需要改 workflow 顶部：

```yaml
env:
  EDGEONE_PROJECT: 新项目名
```

并把 `-a global` 改成对应区域参数（以 CLI `edgeone makers deploy --help` 为准）。

## 4. 绑定域名后要验证的项

```powershell
curl.exe -I https://你的域名/
curl.exe -I https://你的域名/data/token-index-001.bin
curl.exe https://你的域名/robots.txt
```

- 首页 200，SPA 路由 `/library`、`/poem/tang-00001` 不 404；
- `/data/*` 返回 `X-Robots-Tag: noindex`，Range 请求返回 206；
- `robots.txt` 可访问；
- 手机端首页不再出现四格统计堆叠、十二张总集全部竖排的长页面。

## 5. 反爬规则要绑在自定义域名上

EdgeOne 的 Web 防护、速率限制、Bot 管理针对站点/域名生效。默认 `edgeone.dev` 预览域名只适合验证；**长期反爬要在自定义域名上配置**，具体规则见 `deploy/EDGEONE-SECURITY.md`。

## 6. 需要你提供的信息

域名注册完成后，把下面两项发我，我可以继续把绑定步骤走完：

- 域名（例如 `poetry.example.com`）；
- 是否已做 ICP 备案、是否要大陆节点。

如果只做海外节点，不需要备案；如果要大陆节点，必须先有备案，且需要新建项目，不能改当前项目区域。
