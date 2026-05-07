# Claude Code × WPS 智能文档

在 WPS 365 智能文档页面里嵌入一个 Claude Code 入口。用户只管写自然语言诉求，扩展自动把当前文档 URL、选区和标题作为上下文送出。

## 目录结构

```
wps-cc/
├── extension/        ← Chrome 扩展（注入悬浮按钮和输入面板）
│   ├── manifest.json
│   ├── content.js
│   └── content.css
└── bridge/           ← 本地 Node.js 服务（接收扩展请求，调 claude）
    ├── package.json
    └── server.js
```

## 一次性准备

前置：

- Node.js 18+
- Claude Code CLI（命令行能跑通 `claude --version`）
- 已装好 WPS-AirPage-Skill：`npx skills add WPS-SMARTDOCS/WPS-AIRPAGE-SKILL`，并在 Claude Code 里完成首次浏览器登录鉴权。

## 启动 Bridge

```bash
cd bridge
npm install
npm start
# ✅ Bridge listening on http://localhost:5174
```

可选环境变量：

- `PORT`：监听端口，默认 `5174`（如改了，记得同步改 extension/content.js 里的 BRIDGE_URL）
- `CLAUDE_BIN`：claude 可执行文件的路径，默认从 PATH 找
- `CC_TIMEOUT_MS`：单次请求超时，默认 5 分钟

## 安装扩展

1. 打开 Chrome → 访问 `chrome://extensions`
2. 右上角打开"开发者模式"
3. 点"加载已解压的扩展程序" → 选中 `extension/` 文件夹
4. 打开任意 WPS 365 文档（`365.kdocs.cn/...`），右下角应出现黑色圆形 **CC** 按钮

## 用法

- 点右下角 **CC** 按钮，或按 `Alt+J` 打开输入面板
- 上下文区会显示当前文档标题、URL 和选中文本（如有）
- 输入诉求，按"发送"或 `Cmd/Ctrl + Enter`

示例诉求：

| 类型 | 写法 |
|---|---|
| 内容编辑 | "把第二段改写得更正式" |
| 总结 | "总结整篇文档要点，写到文末" |
| 调研 + 写入 | "调研一下国内主流的 RAG 开源框架，整理成表格插入到末尾" |
| 局部润色 | （选中一段后）"把这段改成更口语化的表达，并替换原文" |
| 评审 | "对这份文档逐段提改进建议，作为评论加上去" |

## 工作原理

1. **扩展** 抓取 `location.href`、`document.title`、`window.getSelection().toString()`
2. **Bridge** 把这些拼成 prompt，启动 `claude -p "<prompt>"` 子进程
3. **Claude Code** 看到 prompt 里的 `kdocs / AirPage / 智能文档` 关键词，自动激活 **WPS-AirPage-Skill**
4. **Skill** 解析 URL → file_id，用 CLI 命令完成读 / 写 / 评论操作
5. WPS 365 协同编辑机制让用户当前打开的页面**自动同步**最新内容，不用刷新

## 常见问题

**Q: 点了发送，提示"无法连接本地 Bridge"？**
A: Bridge 没启动或端口被占用。`curl http://localhost:5174/health` 自检。

**Q: Bridge 报"无法启动 claude"？**
A: claude 不在 PATH 里。用 `which claude` 找到绝对路径，启动时设环境变量：
`CLAUDE_BIN=/full/path/to/claude npm start`

**Q: Claude 反馈"鉴权失败"？**
A: AirPage Skill 的 cookie 过期了。在终端跑一次 `node ~/.claude/skills/WPS-AirPage-Skill/scripts/cli.js auth --browser` 重新登录。

**Q: 选中文本捕获不到？**
A: WPS 部分编辑器组件用了 shadow DOM 或自定义选区。先在文档里复制一下选中内容，再把它粘到输入框里也是个稳妥的兜底。

**Q: 想流式看 Claude 的中间过程？**
A: 把 server.js 里的 `--output-format text` 改成 `stream-json`，在 Bridge 里用 SSE 推到扩展，扩展那边把 `cc-output` 改成增量渲染即可。这版起步模板没做，避免一开始太复杂。

## 进阶方向

- **写到 WPS 三方应用** 而不是浏览器扩展：通过 WPS 开放平台的"自定义元素 / 三方应用"机制，把这个面板做成文档原生组件，团队成员开箱即用。需要走金山的应用审核。
- **对接更多 Skill**：同一个 Bridge 也可以服务 dbsheet / 多维表格 等其他 WPS 模块，prompt 里换关键词即可触发对应 Skill。
- **会话连续性**：默认每次请求是独立 session。可以在 Bridge 里维护 sessionId，调 `claude -p --continue` 串起来，让用户能"基于刚才那次再调一下"。
