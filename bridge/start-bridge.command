#!/bin/bash
# start-bridge.command — 双击启动 WPS-Claude Bridge
# macOS Finder 会在 Terminal.app 中打开此文件

cd "$(dirname "$0")"
printf '\033]0;WPS-Claude Bridge\007'

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║     WPS-Claude Bridge 启动中…        ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ─── 环境检查 ───

# PATH 补全（Finder 启动时可能缺少 Homebrew / nvm 路径）
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:$PATH"

# Node.js >= 18
NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ 需要 Node.js 18+（当前: $(node --version 2>/dev/null || echo '未安装')）"
  echo "   安装: brew install node  或  https://nodejs.org"
  echo ""
  read -p "按 Enter 关闭..."
  exit 1
fi

# Claude CLI
if ! command -v claude &>/dev/null; then
  echo "❌ 未找到 claude CLI"
  echo "   安装: npm install -g @anthropic-ai/claude-code"
  echo ""
  read -p "按 Enter 关闭..."
  exit 1
fi

# 端口检查
EXISTING_PID=$(lsof -ti :5174 2>/dev/null)
if [ -n "$EXISTING_PID" ]; then
  echo "⚠️  端口 5174 已被占用 (PID: $EXISTING_PID)"
  echo "   Bridge 可能已在运行，或其他程序占用了此端口。"
  echo ""
  read -p "按 Enter 关闭..."
  exit 1
fi

# 依赖安装
if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ]; then
  echo "📦 安装依赖..."
  npm install --production --silent
  echo ""
fi

echo "✅ Node.js $(node --version)  |  Claude $(claude --version 2>/dev/null | head -1)"
echo ""

# ─── 启动 ───
trap 'echo ""; echo "Bridge 已停止。"; exit 0' INT TERM

exec node server.js
