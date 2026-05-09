#!/bin/bash
# install.command — 一键安装 Claude Code × WPS 智能文档
# macOS Finder 中双击即可运行

cd "$(dirname "$0")"
REPO_DIR="$(pwd)"

printf '\033]0;Claude Code × WPS 安装\007'

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║   Claude Code × WPS 智能文档  一键安装   ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# ─── PATH 补全（Finder 启动时缺少 Homebrew / nvm 路径） ───

export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$PATH"
# nvm
if [ -d "$HOME/.nvm/versions/node" ]; then
  NVM_NODE=$(ls "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)
  [ -n "$NVM_NODE" ] && export PATH="$HOME/.nvm/versions/node/$NVM_NODE/bin:$PATH"
fi
# fnm
if [ -d "$HOME/Library/Application Support/fnm" ]; then
  eval "$(fnm env 2>/dev/null)" || true
fi

# ─── Step 1: 环境检查 ───

echo "▶ 检查环境…"

# Node.js >= 18
NODE_VER=$(node --version 2>/dev/null || echo "")
NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v\([0-9]*\).*/\1/')
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 18 ]; then
  echo ""
  echo "  ❌ 需要 Node.js 18+（当前: ${NODE_VER:-未安装}）"
  echo "     安装方式: brew install node  或  https://nodejs.org"
  echo ""
  read -p "按 Enter 关闭…"
  exit 1
fi
echo "  ✓ Node.js $NODE_VER"

# Claude CLI
CLAUDE_VER=$(claude --version 2>/dev/null | head -1 || echo "")
if [ -z "$CLAUDE_VER" ]; then
  echo ""
  echo "  ⚠️  未找到 claude CLI，正在安装…"
  npm install -g @anthropic-ai/claude-code
  CLAUDE_VER=$(claude --version 2>/dev/null | head -1 || echo "")
  if [ -z "$CLAUDE_VER" ]; then
    echo "  ❌ Claude CLI 安装失败，请手动执行: npm install -g @anthropic-ai/claude-code"
    echo ""
    read -p "按 Enter 关闭…"
    exit 1
  fi
fi
echo "  ✓ Claude CLI $CLAUDE_VER"

# ─── Step 2: 安装 WPS-AirPage-Skill ───

echo ""
echo "▶ 安装 WPS-AirPage-Skill…"

SKILL_SRC="$REPO_DIR/skills/WPS-AirPage-Skill"
SKILL_DST="$HOME/.claude/skills/WPS-AirPage-Skill"

if [ ! -d "$SKILL_SRC" ]; then
  echo "  ❌ 未找到 skills/WPS-AirPage-Skill 目录"
  read -p "按 Enter 关闭…"
  exit 1
fi

mkdir -p "$HOME/.claude/skills"

if [ -d "$SKILL_DST" ]; then
  echo "  ↻ 已存在，更新中…"
  # 保留用户的 node_modules 和本地配置，同步其余文件
  rsync -a --delete \
    --exclude='node_modules' \
    --exclude='.DS_Store' \
    "$SKILL_SRC/" "$SKILL_DST/"
else
  echo "  + 首次安装…"
  cp -R "$SKILL_SRC" "$SKILL_DST"
fi

# 安装 Skill 依赖
if [ -f "$SKILL_DST/package.json" ]; then
  if [ ! -d "$SKILL_DST/node_modules" ] || [ "$SKILL_DST/package.json" -nt "$SKILL_DST/node_modules/.package-lock.json" ]; then
    echo "  📦 安装 Skill 依赖…"
    (cd "$SKILL_DST" && npm install --production --silent 2>/dev/null)
  fi
fi
echo "  ✓ WPS-AirPage-Skill 已就绪"

# ─── Step 3: 安装 Bridge 依赖 ───

echo ""
echo "▶ 安装 Bridge 依赖…"

BRIDGE_DIR="$REPO_DIR/bridge"
if [ ! -d "$BRIDGE_DIR/node_modules" ] || [ "$BRIDGE_DIR/package.json" -nt "$BRIDGE_DIR/node_modules/.package-lock.json" ]; then
  (cd "$BRIDGE_DIR" && npm install --production --silent 2>/dev/null)
fi
echo "  ✓ Bridge 依赖已就绪"

# ─── Step 4: 注册 launchd 开机自启 ───

echo ""
echo "▶ 注册开机自启服务…"

PLIST_NAME="com.wps-claude.bridge"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
LOG_DIR="$HOME/.claude/logs"
mkdir -p "$LOG_DIR"

# 找到当前 node 的绝对路径
NODE_BIN=$(which node)

# 先卸载旧服务（如果存在）
launchctl unload "$PLIST_PATH" 2>/dev/null || true

# 如果端口已被占用（手动启动的旧进程），先终止
OLD_PID=$(lsof -ti :5174 -sTCP:LISTEN 2>/dev/null)
if [ -n "$OLD_PID" ]; then
  echo "  ↻ 端口 5174 已被占用 (PID: $OLD_PID)，正在停止旧进程…"
  kill "$OLD_PID" 2>/dev/null || true
  sleep 1
fi

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$PLIST_NAME</string>

  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$BRIDGE_DIR/server.js</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$BRIDGE_DIR</string>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/bridge.log</string>

  <key>StandardErrorPath</key>
  <string>$LOG_DIR/bridge-error.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$(dirname "$NODE_BIN"):$PATH</string>
    <key>PORT</key>
    <string>5174</string>
  </dict>

  <key>ThrottleInterval</key>
  <integer>5</integer>
</dict>
</plist>
PLIST

launchctl load "$PLIST_PATH"
echo "  ✓ 服务已注册（开机自动启动 + 崩溃自动重启）"

# ─── Step 5: 验证 Bridge 启动 ───

echo ""
echo "▶ 验证 Bridge…"

RETRY=0
while [ $RETRY -lt 10 ]; do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5174/health 2>/dev/null | grep -q "200"; then
    echo "  ✓ Bridge 运行中  http://127.0.0.1:5174"
    break
  fi
  RETRY=$((RETRY + 1))
  sleep 0.5
done

if [ $RETRY -ge 10 ]; then
  echo "  ⚠️  Bridge 未能在 5 秒内启动"
  echo "     查看日志: cat $LOG_DIR/bridge-error.log"
fi

# ─── Step 6: 浏览器扩展引导 ───

echo ""
echo "▶ 安装浏览器扩展…"


EXT_DIR="$REPO_DIR/extension"

# 检测默认浏览器
DEFAULT_BROWSER_ID=$(plutil -convert json -o - \
  ~/Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist 2>/dev/null | \
  python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for h in data.get('LSHandlers', []):
        if h.get('LSHandlerURLScheme') == 'https':
            print(h.get('LSHandlerRoleAll', ''))
            break
except: pass
" 2>/dev/null)

BROWSER_NAME=""
EXT_URL=""
case "$DEFAULT_BROWSER_ID" in
  com.google.chrome)
    BROWSER_NAME="Google Chrome"
    EXT_URL="chrome://extensions"
    ;;
  com.microsoft.edgemac*)
    BROWSER_NAME="Microsoft Edge"
    EXT_URL="edge://extensions"
    ;;
  company.thebrowser.Browser)
    BROWSER_NAME="Arc"
    EXT_URL="chrome://extensions"
    ;;
  com.brave.Browser)
    BROWSER_NAME="Brave Browser"
    EXT_URL="brave://extensions"
    ;;
  com.vivaldi.Vivaldi)
    BROWSER_NAME="Vivaldi"
    EXT_URL="vivaldi://extensions"
    ;;
esac

# 检测扩展是否已安装 (在 Chrome 或 Edge 的 Secure Preferences 中查找)
EXT_INSTALLED=$(python3 -c "
import json, os, glob
patterns = [
    os.path.expanduser('~/Library/Application Support/Google Chrome/*/Secure Preferences'),
    os.path.expanduser('~/Library/Application Support/Microsoft Edge/*/Secure Preferences'),
]
for pattern in patterns:
    for pf in glob.glob(pattern):
        try:
            with open(pf) as f:
                data = json.load(f)
            for info in data.get('extensions', {}).get('settings', {}).values():
                if info.get('location') == 4 and 'wps-cc/extension' in info.get('path', '') and info.get('state') != 0:
                    print('yes')
                    raise SystemExit
        except SystemExit:
            raise
        except:
            pass
" 2>/dev/null)

if [ -n "$BROWSER_NAME" ]; then
  echo "  默认浏览器: $BROWSER_NAME"
fi

if [ "$EXT_INSTALLED" = "yes" ]; then
  echo "  扩展已安装, 正在打开扩展页..."
  if [ -n "$BROWSER_NAME" ]; then
    open -a "$BROWSER_NAME" "$EXT_URL" 2>/dev/null || true
  fi
  echo ""
  echo "  请在扩展管理页中找到 [Claude Code for WPS 365],"
  echo "  点击卡片上的 「刷新」/「重新加载」 按钮完成更新。"
  echo ""
  read -p "  刷新完成后按 Enter 继续..."
else
  echo "  扩展未安装, 正在打开扩展页..."
  if [ -n "$BROWSER_NAME" ]; then
    open -a "$BROWSER_NAME" "$EXT_URL" 2>/dev/null || true
  else
    echo "  请手动打开 Chrome/Edge, 访问 chrome://extensions"
  fi
  echo ""
  echo "  请在扩展管理页中:"
  echo "    1. 开启 [开发者模式] (右上角开关)"
  echo "    2. 点 [加载已解压的扩展程序]"
  echo "    3. 选择此文件夹:"
  echo ""
  echo "       $EXT_DIR"
  echo ""
  read -p "  安装完成后按 Enter 继续..."
fi
echo ""

# ─── 安装完成 ───

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║            ✅ 安装完成！                  ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""
echo "  📌 摘要:"
echo "     Bridge:    后台运行中（开机自启）"
echo "     Skill:     ~/.claude/skills/WPS-AirPage-Skill/"
echo "     扩展路径:  $EXT_DIR"
echo "     日志:      $LOG_DIR/bridge.log"
echo ""
echo "  🔧 常用命令:"
echo "     查看日志    tail -f $LOG_DIR/bridge.log"
echo "     重启服务    launchctl kickstart -k gui/$(id -u)/$PLIST_NAME"
echo "     停止服务    launchctl unload $PLIST_PATH"
echo "     卸载服务    launchctl unload $PLIST_PATH && rm $PLIST_PATH"
echo ""
echo "  打开 WPS 365 文档，右下角出现 CC 按钮即成功 🎉"
echo ""
read -p "按 Enter 关闭…"
