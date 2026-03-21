# Sub Recorder

[![Docker Image](https://img.shields.io/docker/v/shenghuo2/sub-recorder?label=Docker&sort=semver&logo=docker)](https://hub.docker.com/r/shenghuo2/sub-recorder)
[![Image Size](https://img.shields.io/docker/image-size/shenghuo2/sub-recorder/latest?label=Image%20Size&logo=docker)](https://hub.docker.com/r/shenghuo2/sub-recorder)
[![GitHub License](https://img.shields.io/github/license/shenghuo2/sub-recorder?label=License)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-Actix--web-orange?logo=rust)](backend/)
[![Next.js](https://img.shields.io/badge/Next.js%2015-React%2019-black?logo=next.js)](frontend/)

个人订阅管理工具 — 记录和追踪各类订阅服务的费用支出。

> 多币种 · 自动汇率 · 账单周期 · 场景分组 · 分类筛选 · 多渠道通知

<!-- 在此放置截图
![screenshot](docs/screenshot.png)
-->

## 功能特性

- **订阅管理** — 添加 / 编辑 / 暂停 / 恢复，支持图标上传和批量导入
- **费用追踪** — 多币种、自动汇率换算、账单周期管理、历史账单记录
- **场景分组** — 将订阅按场景归组，独立统计费用
- **分类筛选** — 自定义分类与颜色标记，快速过滤
- **日历视图** — 按日期查看即将到期的账单
- **多渠道通知** — SMTP 邮件 / OneBot (QQ) / Telegram / 自定义 Webhook
- **用户认证** — 登录鉴权、密码重置，亦可禁用鉴权
- **轻量部署** — 单进程单端口，Alpine + Rust 二进制 + 静态前端，镜像极小

## 部署

### 快速部署

#### Render

点击下方按钮，使用 [Render](https://render.com/) 一键部署：

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/shenghuo2/sub-recorder)

> **注意**：Render 免费套餐在无请求时会自动休眠。
>
> *Free instances spin down after periods of inactivity. They do not support SSH access, scaling, one-off jobs, or persistent disks. Select any paid instance type to enable these features.*

### Docker

镜像名 `shenghuo2/sub-recorder:latest`

#### Docker Compose（推荐）

```yaml
# docker-compose.yml
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

```bash
docker compose up -d
```

访问 `http://localhost:3000`，首次启动会自动创建 admin 用户并生成随机密码：

```bash
docker logs sub-recorder 2>&1 | grep "密码:"
```

#### Docker Run

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

#### 从源码构建

```bash
git clone https://github.com/shenghuo2/sub-recorder.git
cd sub-recorder
docker compose up -d --build
```

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_PATH` | `/app/data/subscriptions.db` | SQLite 数据库路径 |
| `PORT` | `3000` | 监听端口 |
| `STATIC_DIR` | `/app/static` | 前端静态文件目录 |
| `DISABLE_AUTH` | — | 设为 `true` 或 `1` 禁用鉴权 |

### 用户管理

```bash
# 查看初始密码
docker logs sub-recorder 2>&1 | grep "密码:"

# 重置密码（立即生效，无需重启）
docker exec sub-recorder /app/backend --reset-password
```

登录后也可在「设置」页面修改用户名和密码。

### 数据持久化

数据库存储在容器内 `/app/data/`，通过 volume 映射到宿主机。备份只需复制 `./data/subscriptions.db`。

容器以非 root 用户（UID 1000）运行，如遇权限问题：

```bash
sudo chown -R 1000:1000 ./data
```

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
| `POST /api/import` | 批量导入 |
| `GET /api/fetch-image` | 图片代理 |

## Roadmap

- [ ] 重新设计应用 Logo（近期先支持自定义上传 Logo）
- [ ] Android 客户端 — 基于 Material Design 3 & Monet 动态取色，内置本地数据库，支持与服务端双向同步
- [ ] 后端同步 API — 为多端协同提供增量同步能力

## Contributing

欢迎提交 Issue 和 Pull Request！

## License

[AGPL-3.0](LICENSE)
