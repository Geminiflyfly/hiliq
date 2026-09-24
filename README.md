# Kslit / Hiliq

基于 **Cloudflare Pages + R2 + D1** 的现代化无服务器轻量图床。

- 前端：原生 HTML5 + ES6+ + Tailwind CSS（CDN），无打包
- 后端：Cloudflare Pages Functions（边缘）
- 存储：Cloudflare R2（绑定名 `BUCKET`）
- 账号：Cloudflare D1（绑定名 `DB`）— 登录 / 用户管理
- 能力：拖拽上传、剪贴板粘贴、多格式链接、画廊、管理员用户管理

## 目录结构

```text
├── public/                 # 前台 SPA
├── functions/
│   ├── auth.js             # 会话 / 密码哈希
│   ├── utils.js
│   ├── api/
│   │   ├── upload.js / list.js / delete.js
│   │   ├── users.js        # 用户管理（管理员）
│   │   └── auth/
│   │       ├── setup.js    # 首次创建管理员
│   │       ├── login.js / logout.js / me.js
│   └── img/[[key]].js
├── migrations/0001_init.sql
├── wrangler.toml
└── README.md
```

## Cloudflare 操作步骤（D1 登录）

### 1. 创建 D1 数据库

本机已安装并登录 Wrangler 后执行：

```bash
npx wrangler login
npx wrangler d1 create hiliq-db
```

若已在控制台创建（例如本项目的 `img-db`），可跳过 create，直接把名称和 ID 写入 `wrangler.toml`。

命令会输出类似：

```toml
[[d1_databases]]
binding = "DB"
database_name = "hiliq-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

把 `database_id` 填进仓库根目录 `wrangler.toml` 里对应字段（把 `REPLACE_WITH_D1_DATABASE_ID` 换掉）。

也可在 Dashboard：**Workers & Pages → D1 → Create**，再把 ID 抄进 `wrangler.toml`。

### 2. 执行数据库迁移（建表）

远程（生产）库：

```bash
npx wrangler d1 migrations apply hiliq-db --remote
```

本地开发库：

```bash
npx wrangler d1 migrations apply hiliq-db --local
```

成功后会有 `users`、`sessions` 两张表。

### 3. 确认 wrangler.toml 绑定

```toml
[[d1_databases]]
binding = "DB"                 # 代码里必须是 env.DB
database_name = "hiliq-db"
database_id = "你的-database-id"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "vape-img"

[vars]
CDN_URL = "https://img.kslit.com"
```

> 有 `wrangler.toml` 时，Pages「绑定」页不能手点添加，以文件为准。

### 4. 部署 / 重新部署 Pages

推送代码后等待自动部署，或在 Pages 项目点 **Retry deployment**。

部署完成后打开站点 `https://pic.kslit.com`：

1. 右上角点 **初始化**（首次无用户时）
2. 设置管理员用户名 + 密码（≥6 位）→ 自动登录
3. 之后用 **登录**；管理员可见 **用户** 页，可增删账号

上传 / 画廊 / 删除在启用 D1 且已有用户后需要登录。图片 CDN 外链仍公开可访问。

### 5.（可选）UPLOAD_TOKEN

仍可在环境变量设置 `UPLOAD_TOKEN`，便于脚本上传（等价管理员）。日常请用账号登录。

---

## 快速开始（本地）

```bash
npx wrangler login
npx wrangler d1 create hiliq-db          # 首次
# 编辑 wrangler.toml 填入 database_id
npx wrangler d1 migrations apply hiliq-db --local

npx wrangler pages dev public --r2=BUCKET
```

浏览器打开提示地址（通常 `http://127.0.0.1:8788`），先初始化管理员。

## 部署到 Cloudflare Pages

1. 连接 Git，**Build output directory** = `public`，无构建命令
2. `wrangler.toml` 中 R2 + D1 绑定正确并已 `--remote` 迁移
3. `[vars]` 中 `CDN_URL=https://img.kslit.com`
4. Redeploy

### 图片域名

- 站点：`https://pic.kslit.com`
- 图片：`https://img.kslit.com/...`（不要加 `/img`；空格用 `%20`）

## API 摘要

| 接口 | 说明 |
|------|------|
| `POST /api/auth/setup` | 首次创建管理员（仅用户数为 0） |
| `POST /api/auth/login` | 登录（Set-Cookie 会话） |
| `POST /api/auth/logout` | 退出 |
| `GET /api/auth/me` | 当前用户 / 是否需初始化 |
| `GET/POST/DELETE /api/users` | 用户管理（管理员） |
| `POST /api/upload` | 上传（需登录） |
| `GET /api/list` | 列表（需登录） |
| `POST /api/delete` | 删除（需登录） |

## License

MIT
