# ==================== 后端构建 ====================
FROM rust:1.94-alpine AS backend-builder

RUN apk add --no-cache musl-dev pkgconfig openssl-dev openssl-libs-static

WORKDIR /app/backend
COPY backend/Cargo.toml backend/Cargo.lock ./
COPY backend/src ./src

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

RUN apk add --no-cache libgcc && \
    addgroup -g 1000 app && adduser -u 1000 -G app -s /bin/sh -D app

WORKDIR /app

# 复制后端二进制
COPY --from=backend-builder --chown=app:app /app/backend/target/release/sub-recorder /app/sub-recorder

# 复制前端静态文件（Next.js export 输出到 out/）
COPY --from=frontend-builder --chown=app:app /app/frontend/out /app/static

# 创建数据目录
RUN mkdir -p /app/data && chown app:app /app/data

# 环境变量
ENV DATABASE_PATH=/app/data/subscriptions.db
ENV STATIC_DIR=/app/static
ENV PORT=3000

EXPOSE 3000

USER app

CMD ["/app/sub-recorder"]
