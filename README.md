# Hiliq

基于 **Cloudflare Pages + Cloudflare R2** 的现代化无服务器轻量图床。

- 前端：原生 HTML5 + ES6+ + Tailwind CSS（CDN），无打包
- 后端：Cloudflare Pages Functions（边缘）
- 存储：Cloudflare R2（绑定名 `BUCKET`）
- 能力：拖拽上传、剪贴板粘贴、多格式链接、画廊分页与删除

## 目录结构

```text
├── public/
│   ├── index.html        # 前台单页
│   ├── style.css         # 自定义样式
│   └── app.js            # 前端交互
├── functions/
│   ├── utils.js          # 鉴权 / CORS / URL 工具
│   ├── api/
│   │   ├── upload.js     # POST /api/upload
│   │   ├── list.js       # GET  /api/list
│   │   └── delete.js     # POST|DELETE /api/delete
│   └── img/
│       └── [[key]].js    # GET  /img/<key>  （从 R2 读出图片）
└── README.md
```

> `/img/...` 用于在未开启 R2 公共访问时，通过同域代理访问对象。若已配置自定义域名或 `r2.dev` 公共 URL，可设置环境变量 `CDN_URL` 覆盖返回链接。

## 快速开始（本地）

### 1. 安装依赖

```bash
npm i -g wrangler
# 或
npx wrangler --version
```

登录 Cloudflare：

```bash
wrangler login
```

### 2. 创建 R2 桶

```bash
wrangler r2 bucket create hiliq-images
```

### 3. 本地开发

项目根目录执行（将 `public` 作为静态资源目录，并绑定 R2）：

```bash
npx wrangler pages dev public --r2=BUCKET=hiliq-images
```

可选：带上传令牌启动：

```bash
npx wrangler pages dev public --r2=BUCKET=hiliq-images --binding UPLOAD_TOKEN=your-secret
```

浏览器打开终端提示的本地地址（通常为 `http://127.0.0.1:8788`）。

## 部署到 Cloudflare Pages

### 方式 A：控制台连接 Git

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → 连接本仓库。
2. 构建设置：
   - **Framework preset**：None
   - **Build command**：留空
   - **Build output directory**：`public`
3. **R2 绑定**：本项目通过根目录 `wrangler.toml` 管理绑定（控制台「绑定」页会提示无法手动添加）。  
   打开仓库里的 `wrangler.toml`，把 `bucket_name` 改成你的 R2 桶名：

   ```toml
   [[r2_buckets]]
   binding = "BUCKET"
   bucket_name = "你的桶名"
   ```

   提交并推送后，Pages 会自动带上该绑定。绑定页里应能看到 `BUCKET`。

4. 在 **Settings → Variables and Secrets**（变量和机密）中按需添加：

| 变量 | 必填 | 说明 |
|------|------|------|
| `UPLOAD_TOKEN` | 否 | 上传 / 列表 / 删除鉴权令牌。未设置则接口开放（仅建议内网或临时试用）。 |
| `CDN_URL` | 否 | 图片外链前缀，例如 `https://img.example.com`。未设置时使用 `https://你的域名/img/<key>`。 |

5. 保存后重新部署（Redeploy）。

### 方式 B：Wrangler 直接发布

```bash
npx wrangler pages project create hiliq
npx wrangler pages deploy public --project-name=hiliq
```

部署后确认 `wrangler.toml` 中的 `bucket_name` 与 R2 桶名一致，并按需配置环境变量。

### （推荐）R2 自定义域名

若桶已绑定图片专用域名（例如 `https://img.kslit.com`），站点本身用 `pic.kslit.com`：

1. 在 `wrangler.toml` 的 `[vars]` 中设置（或在 Pages「变量和机密」里设置）：

   ```toml
   CDN_URL = "https://img.kslit.com"
   ```

2. 外链使用图片域名，**不要**加 `/img`，文件夹名里的空格要编码为 `%20`：

   - ✅ `https://img.kslit.com/fizzy%2050k/01-Watermelon-Ice--Strawberry-Kiwi.png`
   - ❌ `https://pic.kslit.com/img/fizzy 50k/01-....png`（站点域名 + `/img` + 未编码空格 → 404）

未设置 `CDN_URL` 时，链接走 Pages 代理：`https://你的站点域名/img/<key>`。

## API 说明

### `POST /api/upload`

- **鉴权**：若配置了 `UPLOAD_TOKEN`，请求头需带  
  `Authorization: Bearer <token>` 或 `X-Upload-Token: <token>`
- **Body**：`multipart/form-data`，字段名 `file`（或 `image`）；也支持直接发送 `Content-Type: image/*` 的原始请求体
- **限制**：图片类型（jpeg/png/gif/webp/svg/avif/bmp/ico），最大 10 MB

成功响应示例：

```json
{
  "success": true,
  "key": "8288123456789-ab12cd34.jpg",
  "url": "https://example.com/img/8288123456789-ab12cd34.jpg",
  "markdown": "![photo.jpg](https://...)",
  "html": "<img src=\"https://...\" alt=\"photo.jpg\" />",
  "bbcode": "[img]https://...[/img]",
  "size": 12345,
  "contentType": "image/jpeg"
}
```

对象键使用「倒序时间戳 + 随机串」，以便 `/api/list` 按字典序即可近似「最新优先」。

### `GET /api/list`

查询参数：

| 参数 | 说明 |
|------|------|
| `limit` | 每页数量，默认 24，最大 100 |
| `cursor` | 上一页返回的游标，用于翻页 |
| `prefix` | 可选，按 key 前缀过滤 |

### `POST /api/delete` 或 `DELETE /api/delete`

```json
{ "key": "8288123456789-ab12cd34.jpg" }
```

`DELETE` 也可使用查询参数：`/api/delete?key=...`

### `GET /img/<key>`

从 R2 流式返回对象（含缓存头与 ETag）。

## 前端使用

1. 打开站点首页，将图片拖入上传区，或点击选择，或 `Ctrl/⌘ + V` 粘贴。
2. 上传成功后可一键复制 **直链 / Markdown / HTML / BBCode**。
3. 顶部切换到 **画廊** 可分页浏览、复制链接或删除。
4. 若启用了 `UPLOAD_TOKEN`，点击 **设置** 将令牌保存在浏览器 `localStorage`（仅本机）。

## 安全建议

- 生产环境务必设置强随机 `UPLOAD_TOKEN`。
- 不要将令牌写入仓库；仅通过 Pages 环境变量注入。
- 如需对外公开读图、限制写操作：保留 `/img` 公开，并为 API 配置令牌即可。

## License

MIT
