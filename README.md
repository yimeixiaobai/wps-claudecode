# Claude Code × WPS 智能文档

在 WPS 365 智能文档页面里嵌入 Claude Code 浮动面板。用户用自然语言描述需求，插件自动关联当前文档上下文（标题、URL、选区），通过本地 Bridge 调用 Claude Code CLI 完成文档读写操作。

## 架构

```
WPS 365 页面 (365.kdocs.cn)
├── content.js (isolated world) — 浮动面板 UI、polling、会话管理
├── inject-sel.js (MAIN world, 按需注入) — 读取 ProseMirror 编辑器选区
│
│  ← HTTP (polling) →
│
└── bridge/server.js (本地 Node.js)
    ├── POST /start — 启动 claude CLI 子进程，返回 session ID
    ├── GET /poll/:id — 轮询获取流式事件（delta、tool_start、done 等）
    ├── POST /stop/:id — 中止 claude 进程
    └── GET /local-sessions — 列出本地 Claude Code 会话（供导入）
```

**为什么用 polling 而不是 SSE/WebSocket？**
WPS 页面的网络环境会中断长连接（Service Worker / 混合内容策略），polling 模式用短连接 JSON 响应，100% 可靠。

## 目录结构

```
wps-cc/
├── extension/          ← Chrome/Edge 扩展
│   ├── manifest.json
│   ├── content.js      ← 面板 UI + 会话管理 + polling
│   ├── content.css     ← 样式（Obsidian Ember 主题）
│   └── inject-sel.js   ← 按需注入到页面读取 WPS 编辑器选区
└── bridge/             ← 本地 Node.js 服务
    ├── package.json
    └── server.js       ← Express 服务 + Claude CLI 子进程管理
```

## 前置要求

- Node.js 18+
- Claude Code CLI（`claude --version` 可用）
- WPS-AirPage-Skill 已安装：`npx skills add WPS-SMARTDOCS/WPS-AIRPAGE-SKILL`

## 快速开始

### 1. 启动 Bridge

**方式 A（推荐）：** 在 Finder 中双击 `bridge/start-bridge.command`

**方式 B（终端）：**
```bash
cd bridge && npm install && npm start
```

> 停止：关闭终端窗口，或双击 `bridge/stop-bridge.command`
>
> 首次双击 `.command` 文件如果被 macOS 拦截，右键 → 打开 即可。

### 2. 安装扩展

1. 打开 `chrome://extensions`（或 `edge://extensions`）
2. 开启「开发者模式」
3. 点「加载已解压的扩展程序」→ 选 `extension/` 文件夹
4. 打开 WPS 365 文档，右下角出现橘色 CC 按钮

### 3. 使用

- 点 **CC 按钮** 或按 **Alt+J** 打开面板
- 在文档中选中文字，面板输入框上方自动显示选区引用
- 输入请求，按 **⌘/Ctrl+Enter** 发送
- 实时看到工具调用步骤 → 流式文字输出 → 完成后自动折叠步骤摘要

## 核心功能

### 文档选区捕获
WPS 编辑器是 ProseMirror 架构，标准 `window.getSelection()` 不可用。插件通过按需注入 `inject-sel.js` 到页面主世界，调用 `APP.core.editor.state.doc.textBetween(from, to)` 读取选区，避免持久驻留 MAIN world 导致内存泄漏。

### 流式输出 + 中间过程
Bridge 解析 Claude CLI 的 `stream-json` 输出，转换为前端事件：
- `status` — 启动/等待/回复中
- `thinking_start/done` — 深度思考指示
- `tool_start/detail/result` — 工具调用步骤（中文标签 + 描述）
- `delta` — 文字增量流式渲染
- `done` — 完成，步骤自动折叠为摘要

### 多轮会话
利用 Claude CLI 的 `--resume <session_id>` 机制：
- 同一会话内多条消息共享上下文
- 清空对话 → 开启新 session
- 每个文档的会话独立隔离

### 导入本地 Claude Code 会话
从 `~/.claude/projects/` 扫描本地 session 文件，提取标题和摘要，用户通过列表选择导入。使用 `--fork-session` 创建分支，不干扰终端正在运行的 session。

## 安全说明

- **Bridge 仅监听 127.0.0.1**：不对外暴露，只有本机可访问
- **CORS 限制**：仅允许来自 `365.kdocs.cn` 和 `www.kdocs.cn` 的请求
- **`--dangerously-skip-permissions`**：Bridge 调用 Claude CLI 时跳过权限确认，以实现自动化操作。这意味着 Claude 可以不经确认地读写本地文件和执行命令。请确保你信任你发送的请求内容
- **WPS Cookie**：存储在 `~/.claude/secrets/wps365.json`，不会出现在代码或日志中

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `5174` | Bridge 监听端口 |
| `CLAUDE_BIN` | `claude` | Claude CLI 路径 |
| `CC_TIMEOUT_MS` | `600000` (10分钟) | 单次请求超时 |

## 常见问题

**Q: 点发送后提示「无法连接 Bridge」？**
Bridge 没启动。运行 `cd bridge && npm start`。

**Q: 选区捕获不到？**
确认在文档编辑区域选中了文字（非面板内部）。WPS 编辑器需要通过 ProseMirror API 读取。

**Q: 导入本地会话后报错「No conversation found」？**
Session 文件可能已过期或被清理。尝试导入更近期的会话。

**Q: 内存占用过高？**
正常情况下 WPS 页面约 1-2 GB。如果超过 3 GB，检查是否打开了 DevTools（DevTools 自身会占用大量内存）。
