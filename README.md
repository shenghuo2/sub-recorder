# Sub Recorder

个人订阅管理工具，用于记录和追踪各类订阅服务的费用。支持多币种、账单周期管理、场景分组、分类筛选、多渠道通知等功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 15 · React 19 · Tailwind CSS · shadcn/ui |
| **后端** | Rust · Actix-web · SQLite |
| **部署** | Docker · 多架构 (amd64/arm64) |

## 系统架构

```
┌──────────────────────────────────────────────┐
│              Docker Container                │
│                                              │
│   ┌────────────────────────────────────┐     │
│   │        Rust (Actix-web) :3000      │     │
│   │                                    │     │
│   │   /api/*  ──▶  API Handlers        │     │
│   │   /*      ──▶  静态文件 (SPA)      │     │
│   │                                    │     │
│   └──────────────────┬─────────────────┘     │
│                      │                       │
│                      ▼                       │
│               ┌─────────────┐                │
│               │   SQLite    │                │
│               │  /app/data  │                │
│               └─────────────┘                │
│                                              │
└──────────────────────┬───────────────────────┘
                       │
               ┌───────┴───────┐
               │   用户浏览器   │
               │  :3000 访问   │
               └───────────────┘
```

**设计要点**:
- **单进程单端口** — Rust 同时提供 API 和前端静态文件服务
- 前端使用 Next.js 静态导出，无需 Node.js 运行时
- 非 root 用户运行 (UID 1000)
- 数据持久化到 `/app/data/`
- 镜像极小：Alpine + 单个 Rust 二进制 + 静态前端文件

## 功能特性

```
┌────────────────────────────────────────────────────────────────┐
│                        Sub Recorder                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  📦 订阅管理          💰 费用追踪          📊 数据分析         │
│  ├─ 添加/编辑/删除    ├─ 多币种支持        ├─ 月度统计         │
│  ├─ 暂停/恢复         ├─ 自动汇率换算      ├─ 分类汇总         │
│  ├─ 图标上传/URL      ├─ 账单周期管理      └─ 场景分组         │
│  └─ 批量导入          └─ 历史账单记录                          │
│                                                                │
│  🏷️ 分类管理          📅 日历视图          🔔 通知提醒         │
│  ├─ 自定义分类        ├─ 按日期筛选        ├─ SMTP 邮件        │
│  ├─ 颜色标记          └─ 账单日提醒        └─ Webhook/OneBot   │
│  └─ 快速筛选                                                   │
│                                                                │
│  🎨 场景分组          🔐 用户认证          ⚙️ 系统设置         │
│  ├─ 订阅归组          ├─ 登录鉴权          ├─ API 地址配置     │
│  ├─ 独立统计          ├─ 密码重置          ├─ 货币/汇率设置    │
│  └─ Logo 聚合         └─ 可禁用鉴权        └─ 周期格式选择     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## 快速开始 (Docker)

### 使用 Docker Compose (推荐)

1. 创建 `docker-compose.yml`:

```yaml
services:
  sub-recorder:
    image: shenghuo2/sub-recorder:latest
    container_name: sub-recorder
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - DATABASE_PATH=/app/data/subscriptions.db
```

2. 启动:

```bash
docker compose up -d
```

3. 访问 `http://localhost:3000`

首次启动会自动创建 admin 用户并生成随机密码，通过日志查看:

```bash
docker logs sub-recorder 2>&1 | grep "密码:"
```

### 使用 Docker Run

```bash
mkdir -p ./data

docker run -d \
  --name sub-recorder \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  -e DATABASE_PATH=/app/data/subscriptions.db \
  shenghuo2/sub-recorder:latest
```

### 从源码构建

```bash
git clone <repo-url>
cd sub-recorder
docker compose up -d --build
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_PATH` | `/app/data/subscriptions.db` | SQLite 数据库文件路径 |
| `PORT` | `3000` | 服务监听端口 |
| `STATIC_DIR` | `/app/static` | 前端静态文件目录 |
| `DISABLE_AUTH` | 未设置 | 设为 `true` 或 `1` 可禁用鉴权 |

## 用户管理

### 查看初始密码

首次启动时自动创建的 admin 密码会打印在日志中:

```bash
docker logs sub-recorder 2>&1 | grep "密码:"
```

### 重置密码

在容器内执行:

```bash
docker exec sub-recorder /app/backend --reset-password
```

会输出新的随机密码，立即生效，无需重启容器。

### 登录后修改密码

登录后可在「设置」页面中修改用户名和密码。

## 端口说明

容器只暴露一个端口 `3000`，Rust 后端同时提供 API (`/api/*`) 和前端静态文件 (`/*`) 服务。

## 数据持久化

数据库文件存储在 `/app/data/` 目录下，通过 volume 挂载到宿主机的 `./data` 目录。

备份数据只需复制 `./data/subscriptions.db` 文件。

容器以非 root 用户 (UID 1000) 运行，请确保宿主机挂载目录对该 UID 可写:

```bash
# 如遇权限问题
sudo chown -R 1000:1000 ./data
```

## 本地开发

### 后端

```bash
cd backend
cargo run
```

默认监听 `http://localhost:3456`。

### 前端

```bash
cd frontend
npm install
npm run dev
```

默认监听 `http://localhost:3000`，开发模式下 API 请求通过 Next.js API 路由代理到后端。

## 项目结构

```
sub-recorder/
├── backend/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs            # 入口 & 路由注册
│   │   ├── handlers.rs        # API 处理器
│   │   ├── db.rs              # 数据库操作
│   │   ├── models.rs          # 数据模型
│   │   └── auth.rs            # 鉴权中间件
│   └── Cargo.toml
│
├── frontend/                   # Next.js 前端
│   ├── src/
│   │   ├── app/               # App Router 页面
│   │   ├── components/        # React 组件
│   │   └── lib/               # 工具函数 & API 客户端
│   └── package.json
│
├── Dockerfile                  # 多阶段构建
├── docker-compose.yml
└── README.md
```

## API 概览

```
┌─────────────────────────────────────────────────────────────┐
│                        REST API                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  /api/subscriptions          订阅管理 (CRUD)                │
│  /api/subscriptions/:id/bills  账单记录                     │
│  /api/categories             分类管理 (CRUD)                │
│  /api/scenes                 场景管理 (CRUD)                │
│  /api/notifications/channels 通知渠道 (CRUD)                │
│  /api/notifications/test     测试通知发送                   │
│  /api/auth/login             用户登录                       │
│  /api/auth/check             鉴权检查                       │
│  /api/auth/user              用户信息 (GET/PUT)             │
│  /api/import                 批量导入                       │
│  /api/fetch-image            图片代理                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## License

MIT
