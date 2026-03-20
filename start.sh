#!/usr/bin/env bash
set -e

# 一键启动 Sub Recorder 前后端
# 用法: ./start.sh [--no-update]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
NO_UPDATE=false

for arg in "$@"; do
  case $arg in
    --no-update) NO_UPDATE=true ;;
  esac
done

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYAN}[SR]${NC} $1"; }
ok()  { echo -e "${GREEN}[SR]${NC} $1"; }
warn(){ echo -e "${YELLOW}[SR]${NC} $1"; }
err() { echo -e "${RED}[SR]${NC} $1"; }

cleanup() {
  log "正在停止服务..."
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null
    ok "后端已停止 (PID $BACKEND_PID)"
  fi
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null
    ok "前端已停止 (PID $FRONTEND_PID)"
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM

# ========== 检查依赖 ==========
log "检查依赖..."

if ! command -v cargo &>/dev/null; then
  err "未找到 cargo，请先安装 Rust: https://rustup.rs"
  exit 1
fi

if ! command -v node &>/dev/null; then
  err "未找到 node，请先安装 Node.js: https://nodejs.org"
  exit 1
fi

if ! command -v npm &>/dev/null; then
  err "未找到 npm"
  exit 1
fi

ok "依赖检查通过 (cargo=$(cargo --version | cut -d' ' -f2), node=$(node --version))"

# ========== Git 更新 ==========
if [ "$NO_UPDATE" = false ] && [ -d "$SCRIPT_DIR/.git" ]; then
  log "检查代码更新..."
  cd "$SCRIPT_DIR"
  git fetch --quiet 2>/dev/null || true
  LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "")
  REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
  BASE=$(git merge-base HEAD @{u} 2>/dev/null || echo "")
  
  if [ -z "$LOCAL" ] || [ -z "$REMOTE" ]; then
    warn "无法检查远程更新（可能没有设置上游分支）"
  elif [ "$LOCAL" = "$REMOTE" ]; then
    ok "代码已是最新"
  elif [ "$LOCAL" = "$BASE" ]; then
    # 本地落后于远程，需要拉取
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
      warn "发现远程更新，但本地有未提交的更改，跳过自动更新"
    else
      warn "发现远程更新，正在拉取..."
      git pull --rebase || { err "git pull 失败，请手动处理"; exit 1; }
      ok "代码已更新"
    fi
  elif [ "$REMOTE" = "$BASE" ]; then
    # 本地领先于远程（有未推送的 commit）
    warn "本地有未推送的提交，跳过自动更新"
  else
    # 本地和远程有分叉
    warn "本地和远程有分叉，跳过自动更新，请手动处理"
  fi
fi

# ========== 后端 ==========
log "构建后端..."
cd "$BACKEND_DIR"
cargo build --release 2>&1 | tail -3
ok "后端构建完成"

log "启动后端 (端口 3456)..."
PORT=3456 RUST_LOG=info "$BACKEND_DIR/target/release/sub-recorder" &
BACKEND_PID=$!
sleep 1

if kill -0 "$BACKEND_PID" 2>/dev/null; then
  ok "后端已启动 (PID $BACKEND_PID) → http://localhost:3456"
else
  err "后端启动失败"
  exit 1
fi

# ========== 前端 ==========
log "安装前端依赖..."
cd "$FRONTEND_DIR"
npm install --silent 2>&1 | tail -3
ok "前端依赖已安装"

log "启动前端 (开发模式)..."
npm run dev &
FRONTEND_PID=$!
sleep 3

if kill -0 "$FRONTEND_PID" 2>/dev/null; then
  ok "前端已启动 (PID $FRONTEND_PID) → http://localhost:3000"
else
  err "前端启动失败"
  cleanup
  exit 1
fi

echo ""
ok "=========================================="
ok "  Sub Recorder 已启动！"
ok "  前端: http://localhost:3000"
ok "  后端: http://localhost:3456"
ok "  按 Ctrl+C 停止所有服务"
ok "=========================================="
echo ""

# 等待子进程
wait
