#!/bin/bash
# stop-bridge.command — 双击停止 WPS-Claude Bridge

PID=$(lsof -ti :5174 2>/dev/null)
if [ -n "$PID" ]; then
  kill "$PID" 2>/dev/null
  echo "✅ Bridge 已停止 (PID: $PID)"
else
  echo "Bridge 未在运行"
fi

read -p "按 Enter 关闭..."
