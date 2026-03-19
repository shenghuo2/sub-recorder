# ==================== 后端构建 ====================
FROM rust:1.94-alpine AS backend-builder

RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static

WORKDIR /app/backend
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src

# 静态链接构建
ENV RUSTFLAGS="-C target-feature=-crt-static"
RUN cargo build --release && strip target/release/sub-recorder

# ==================== 前端构建 ====================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ==================== 最终镜像 ====================
FROM alpine:3.20

RUN apk add --no-cache libgcc nodejs && \
    addgroup -g 1000 app && adduser -u 1000 -G app -s /bin/sh -D app

WORKDIR /app

# 复制后端（用 --chown 避免额外层）
COPY --from=backend-builder --chown=app:app /app/backend/target/release/sub-recorder /app/backend

# 复制前端 standalone
COPY --from=frontend-builder --chown=app:app /app/frontend/.next/standalone /app/frontend
COPY --from=frontend-builder --chown=app:app /app/frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-builder --chown=app:app /app/frontend/public /app/frontend/public

# 创建数据目录
RUN mkdir -p /app/data && chown app:app /app/data

# 环境变量
ENV DATABASE_PATH=/app/data/subscriptions.db
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV BACKEND_URL=http://127.0.0.1:3456

# 只暴露前端端口，后端仅内部访问
EXPOSE 3000

# 启动脚本
COPY --chown=app:app <<EOF /app/start.sh
#!/bin/sh
set -e

echo "[SR] 启动后端..."
cd /app
PORT=3456 ./backend &
BACKEND_PID=\$!

# 等待后端就绪
sleep 2
if ! kill -0 \$BACKEND_PID 2>/dev/null; then
  echo "[SR] 后端启动失败"
  exit 1
fi
echo "[SR] 后端已启动 (PID \$BACKEND_PID)"

echo "[SR] 启动前端..."
cd /app/frontend && PORT=3000 node server.js
EOF
RUN chmod +x /app/start.sh

# 切换到非 root 用户
USER app

CMD ["/app/start.sh"]
