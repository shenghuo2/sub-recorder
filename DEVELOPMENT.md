# 开发指南

## 本地开发

```bash
# 后端 — 默认监听 :3456
cd backend && cargo run

# 前端 — 默认监听 :3000，API 代理到后端
cd frontend && npm install && npm run dev
```

## 项目结构

```
sub-recorder/
├── backend/                 # Rust 后端 (Actix-web)
│   ├── src/
│   │   ├── main.rs          # 入口 & 路由
│   │   ├── handlers.rs      # API 处理器
│   │   ├── db.rs            # 数据库操作
│   │   ├── models.rs        # 数据模型
│   │   └── auth.rs          # 鉴权中间件
│   └── Cargo.toml
├── frontend/                # Next.js 前端
│   ├── src/
│   │   ├── app/             # App Router
│   │   ├── components/      # React 组件
│   │   └── lib/             # API 客户端 & 工具
│   └── package.json
├── Dockerfile               # 多阶段构建
├── docker-compose.yml
└── README.md
```

## 技术栈

| | 技术 |
|---|---|
| **前端** | Next.js 15 · React 19 · Tailwind CSS · shadcn/ui |
| **后端** | Rust · Actix-web · SQLite |
| **部署** | Docker · 多架构 (amd64/arm64) |

### 架构概览

```
Docker Container
┌─────────────────────────────────┐
│  Rust (Actix-web) :3000        │
│   /api/*  → API Handlers       │
│   /*      → 静态文件 (SPA)     │
│              │                  │
│           SQLite                │
│         /app/data/              │
└─────────────────────────────────┘
```

- 单进程单端口，Rust 同时提供 API 和前端静态文件
- 前端 Next.js 静态导出，无需 Node.js 运行时

## API 概览

| 端点 | 说明 |
|------|------|
| `GET/POST /api/subscriptions` | 订阅管理 |
| `GET/POST /api/subscriptions/:id/bills` | 账单记录 |
| `GET/POST /api/categories` | 分类管理 |
| `GET/POST /api/scenes` | 场景管理 |
| `GET/POST /api/notifications/channels` | 通知渠道 |
| `POST /api/notifications/test` | 测试通知 |
| `POST /api/auth/login` | 登录 |
| `GET /api/auth/check` | 鉴权检查 |
| `GET/PUT /api/auth/user` | 用户信息 |
| `GET /api/export` | 导出全部数据 |
| `POST /api/import/native` | 导入原生备份 |
| `POST /api/import` | 批量导入（旧格式兼容） |
| `GET /api/fetch-image` | 图片代理 |

## 版本发布

项目使用 [Release Drafter](https://github.com/release-drafter/release-drafter) 自动生成 Release 草稿。每次 push 到 `main` 或合并 PR 时，会根据 PR 标签自动归类更新内容。

- 配置文件：[`.github/release-drafter.yml`](../.github/release-drafter.yml)
- PR 标签分类：`feature`/`enhancement` → 新功能，`fix`/`bug` → Bug 修复，`ui`/`style` → UI 样式，`chore`/`refactor` → 维护，`docs` → 文档
- 版本号通过 `major` / `minor` / `patch` 标签自动递增，默认 patch

手动触发 Docker 构建 workflow 时会自动创建正式 Release 并打 tag。
